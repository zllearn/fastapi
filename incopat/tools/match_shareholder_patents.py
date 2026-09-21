"""Read-only source matching: shareholder/inventor leads are NOT ownership."""
import csv
import json
import re
import sqlite3
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_atlas_payload import read_xlsx_rows
from fuzzy_match_unlinked_enterprises import ROOT, norm, xlsx

SOURCE = ROOT.parent / 'inputs'
BOOK = SOURCE / '股东穿透与历史任职_结果.xlsx'
PATENTS = SOURCE / 'IncoPat筛选维度后_已回填企业类型及国家及技术标签.xlsx'
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def records(sheet):
    rows = read_xlsx_rows(BOOK, sheet)
    return [dict(zip(rows[0], row)) for row in rows[1:] if any(row)]

def tokens(value):
    return {norm(v) for v in re.split(r'[;；\n|]+', value or '') if norm(v)}

def patent_rows():
    """Stream the source workbook without retaining its large worksheet tree."""
    with ZipFile(PATENTS) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            with z.open('xl/sharedStrings.xml') as f:
                for _, elem in ET.iterparse(f, events=('end',)):
                    if elem.tag == NS+'si':
                        strings.append(''.join(t.text or '' for t in elem.iter(NS+'t')))
                        elem.clear()
        headers = {}
        with z.open('xl/worksheets/sheet1.xml') as f:
            context = ET.iterparse(f, events=('start', 'end'))
            _, root = next(context)
            for event, elem in context:
                if event != 'end' or elem.tag != NS+'row':
                    continue
                row = {}
                for cell in elem.findall(NS+'c'):
                    col = re.match('[A-Z]+', cell.attrib['r']).group()
                    value = cell.findtext(NS+'v', '')
                    if cell.attrib.get('t') == 's':
                        value = strings[int(value)] if value else ''
                    elif cell.attrib.get('t') == 'inlineStr':
                        value = ''.join(t.text or '' for t in cell.iter(NS+'t'))
                    row[col] = value
                if not headers:
                    headers = row
                    assert '发明人' in headers.values() and '家族ID' in headers.values(), headers
                    print('专利字段已读取，开始逐行匹配', flush=True)
                else:
                    yield {headers.get(k, k): v for k, v in row.items()}
                elem.clear()
                root.clear()

def main():
    stamp = '20260916'  # 与随包核验快照保持一致
    output = ROOT / 'output'
    def csv_rows(name):
        with (output/name).open(encoding='utf-8-sig') as f:
            return list(csv.DictReader(f))
    unlinked = csv_rows(f'暂未关联专利企业名单_{stamp}.csv')
    calibration = csv_rows(f'剩余企业名称校准_排除49家_{stamp}.csv')
    shares = records('股东信息汇总')
    locate = records('企业定位结果')
    positions = records('自然人历史任职')
    penetration = records('法人股东穿透')
    company_rows = defaultdict(list)
    for row in shares:
        company_rows[row['公司名称']].append(row)
    # Only explicit parent -> named shareholder edges; never infer control.
    graph = defaultdict(list)
    for row in penetration:
        graph[norm(row['被穿透法人'])].append(row)
    paths = []
    for company, rows in company_rows.items():
        def walk(name, kind, chain, historic, start, end, visited):
            if kind == '自然人':
                paths.append(dict(company=company, person=name, path=' → '.join(chain),
                                  historic=historic, start=start, end=end,
                                  indirect=len(chain)>2))
                return
            key = norm(name)
            if key in visited:
                return
            for edge in graph[key]:
                walk(edge['股东名称'], edge['股东类型'], chain+[edge['股东名称']],
                     historic, start, end, visited|{key})
        for row in rows:
            walk(row['股东名称'], row['股东类型'], [company, row['股东名称']],
                 row.get('是否历史股东', '未知'), row.get('股东起始日期', ''),
                 row.get('股东退出日期', ''), set())
    persons = {norm(p['person']) for p in paths}
    hits = defaultdict(dict)
    conn = sqlite3.connect(f'file:{output / "统一专利族数据.sqlite3"}?mode=ro', uri=True)
    family_ids = {str(r[0]) for r in conn.execute('select family_id from families')}
    conn.close()
    scanned = 0
    for row in patent_rows():
        scanned += 1
        matched = tokens(row.get('发明人', '')) & persons
        if not matched:
            continue
        fid = row.get('家族ID', '').strip()
        if fid not in family_ids:
            continue
        for person in matched:
            hits[person].setdefault(fid, row)
    print(f'扫描 {scanned} 行，命中 {len(hits)} 个自然人姓名', flush=True)
    # Relate missing website entries through exact name or supplied credit-code mapping.
    company_norm = {norm(c): c for c in company_rows}
    codes = defaultdict(set)
    for c, rows in company_rows.items():
        for row in rows:
            if row.get('统一社会信用代码'):
                codes[row['统一社会信用代码']].add(c)
    explicit = defaultdict(set)
    for row in locate:
        code = row.get('统一社会信用代码/备注', '')
        if re.fullmatch('[A-Z0-9]{18}', code):
            for name in (row['原名'], row['校准后名称']):
                explicit[norm(name)].update(codes.get(code, set()))
    suggested = {norm(r['原名']): r for r in calibration}
    mappings = []
    for row in unlinked:
        name = row['企业名称']; key = norm(name)
        exact = {company_norm[key]} if key in company_norm else set()
        direct = exact | explicit[key]
        for c in sorted(direct):
            mappings.append((name, c, '名称直接对应' if c in exact else '结果表信用代码映射（未独立核验）'))
        if not direct:
            for candidate in suggested.get(key, {}).get('校准后名称', '').split(' / '):
                ck = norm(candidate)
                candidates = ({company_norm[ck]} if ck in company_norm else set()) | explicit[ck]
                for c in sorted(candidates):
                    mappings.append((name, c, '名称校准候选，主体待核验'))
    mappings = sorted(set(mappings))
    employment = defaultdict(list)
    for row in positions:
        employment[(norm(row['所属公司']), norm(row['股东姓名']))].append(row)
    detail = [['企业名称','统一社会信用代码','自然人股东','股权路径','直接或间接','是否历史股东','股东起始日期','退出日期','专利族ID','代表公开号','专利标题','发明人','申请人','当前权利人','最早优先权日','交叉任职单位','核验级别','申请早于股东起始日','来源','源专利Excel行号说明']]
    detail[0].append('目标企业本身为申请人或当前权利人')
    company_hits = defaultdict(set); current_hits = defaultdict(set); corroborated = defaultdict(set)
    target_direct = defaultdict(set)
    for p in paths:
        c = p['company']; person = norm(p['person'])
        for fid, patent in sorted(hits.get(person, {}).items()):
            owners = tokens(patent.get('申请人','')) | tokens(patent.get('当前权利人',''))
            related = [r['历史任职公司'] for r in employment[(norm(c),person)]
                       if norm(r['历史任职公司']) in owners]
            if norm(c) in owners:
                related.append(c)
                target_direct[c].add(fid)
            related = sorted(set(related))
            grade = '同名及单位交叉线索，仍需人员核验' if related else '仅发明人同名，须人工核验'
            priority = patent.get('最早优先权日','')
            before = '未知'
            if re.match(r'^\d{4}-\d{2}-\d{2}', priority) and re.match(r'^\d{4}-\d{2}-\d{2}',p['start']):
                before = '是' if priority[:10] < p['start'][:10] else '否'
            company_hits[c].add(fid)
            if p['historic'] == '否': current_hits[c].add(fid)
            if related: corroborated[c].add(fid)
            detail.append([c,company_rows[c][0]['统一社会信用代码'],p['person'],p['path'],
                           '间接（上层股东时点未核验）' if p['indirect'] else '直接',p['historic'],p['start'],p['end'],fid,
                           patent.get('家族代表公开（公告）号',''),patent.get('标题 (中文)','') or patent.get('标题 (英文)',''),
                           patent.get('发明人',''),patent.get('申请人',''),patent.get('当前权利人',''),priority,
                           '；'.join(related),grade,before,BOOK.name+'；'+PATENTS.name,'以专利族ID回查源表；同族仅保留首条命中记录',
                           '是（应优先核验企业名称映射，不是迁移）' if norm(c) in owners else '否'])
    summary = [['网站原企业名称','结果表企业名称','名称对应口径','统一社会信用代码','股东同名候选专利族数','现任股东候选族数','仅历史股东候选族数','有单位交叉线索族数','可确认迁移族数','是否需要人工核验','目标企业直接出现在专利中族数','目标企业未直接出现的同名候选族数']]
    for original,c,method in mappings:
        summary.append([original,c,method,company_rows[c][0]['统一社会信用代码'],len(company_hits[c]),len(current_hits[c]),
                        len(company_hits[c]-current_hits[c]),len(corroborated[c]),0,'是：人员身份、主体名称及权属分别核验',
                        len(target_direct[c]),len(company_hits[c]-target_direct[c])])
    all_companies = [['结果表企业名称','统一社会信用代码','自然人路径数','命中姓名数','候选族数','现任股东候选族数','单位交叉线索族数']]
    for c in sorted(company_rows):
        ps = [p for p in paths if p['company']==c]
        all_companies.append([c,company_rows[c][0]['统一社会信用代码'],len(ps),len({norm(p['person']) for p in ps if hits.get(norm(p['person']))}),len(company_hits[c]),len(current_hits[c]),len(corroborated[c])])
    stats = dict(source_companies=len(company_rows),source_share_rows=len(shares),natural_person_names=len(persons),
                 inventor_names_hit=len(hits),scanned_patent_rows=scanned,website_unlinked=len(unlinked),
                 website_mapped=len({m[0] for m in mappings}),
                 website_with_candidates=len({o for o,c,m in mappings if company_hits[c]}),
                 exact_or_code_with_candidates=len({o for o,c,m in mappings if company_hits[c] and '候选' not in m}),
                 name_candidate_only_with_candidates=len({o for o,c,m in mappings if company_hits[c] and '候选' in m}),
                 current_shareholder_candidate_companies=len({o for o,c,m in mappings if current_hits[c]}),
                 unit_corroborated_companies=len({o for o,c,m in mappings if corroborated[c]}),
                 target_direct_patent_companies=len({o for o,c,m in mappings if target_direct[c]}),
                 external_same_name_candidate_companies=len({o for o,c,m in mappings if company_hits[c]-target_direct[c]}),
                 all_source_companies_with_hits=sum(bool(company_hits[c]) for c in company_rows),
                 distinct_candidate_families=len(set().union(*company_hits.values())),
                 confirmed_transfer_families=0,detail_rows=len(detail)-1)
    notes = [['项目','说明'],['结果性质','仅同名候选线索，不是发明人身份确认，不证明股东拥有专利，也不证明专利迁移。未修改网站或原始文件。'],
             ['范围','只匹配本地核聚变专利数据、且专利族ID在当前统一库存在；并非全国所有专利。'],
             ['现任口径','依结果表是否历史股东=否；间接股东上层时点未提供，不视为确认当前持股。'],
             ['任职日期','公司注册日期不是任职起止日期，未用于证明发明时任职关系。'],
             ['名称映射','直接名称仅做全半角、标点、空格规范化；信用代码映射采用用户结果表；模糊校准一律待核验。'],
             ['计数','按企业内专利族去重；同族可命中多个股东、多个企业，不可将各行简单相加。'],
             ['直接出现','目标企业本身为申请人或当前权利人的专利优先按名称校准处理，不能作为股权导致专利迁移的证据。'],
             ['数据来源','用户提供结果表，原表概览声称启信慧眼；本次未独立联网验证工商记录。'],
             ['未命中','不代表没有专利，可能存在数据范围、姓名译写、主体未覆盖等原因。'],
             ['需要核验','人员履历、发明时单位、共同发明人、地址；权属迁移另需转让或法律状态记录。'],
             ['输入文件',str(BOOK)],['专利输入文件',str(PATENTS)]]
    notes += [[k,v] for k,v in stats.items()]
    path_rows = [['企业名称','自然人姓名','路径','历史股东标记','直接股东起始日','退出日','是否间接']]+[[p['company'],p['person'],p['path'],p['historic'],p['start'],p['end'],str(p['indirect'])] for p in paths]
    unmapped = [['网站原企业名称','原因']]+[[r['企业名称'],'本次股东结果表未定位到主体（含校准候选）'] for r in unlinked if r['企业名称'] not in {m[0] for m in mappings}]
    base = output/f'股东发明人专利关联_待核验_{stamp}'
    sheets = [('暂未关联企业补充汇总',summary),('股东专利候选明细',detail),('全部结果企业统计',all_companies),('自然人股权路径',path_rows),('未覆盖企业',unmapped),('口径与统计',notes)]
    xlsx(base.with_suffix('.xlsx'),sheets)
    for suffix, rows in [('企业汇总',summary),('关联明细',detail)]:
        with Path(str(base)+'_'+suffix+'.csv').open('w',encoding='utf-8-sig',newline='') as f:
            csv.writer(f).writerows(rows)
    base.with_suffix('.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
    for name, rows in sheets:
        assert len(read_xlsx_rows(base.with_suffix('.xlsx'),name))==len(rows)
    print(json.dumps({'xlsx':str(base.with_suffix('.xlsx')),**stats},ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
