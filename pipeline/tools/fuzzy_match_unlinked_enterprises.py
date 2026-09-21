"""Generate review candidates; never change website identity mappings."""
import csv
import json
import re
import unicodedata
from collections import Counter
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT.parent / 'frontend'

def load(name):
    return json.loads((SITE / 'assets/atlas/data' / name).read_text().split('=', 1)[1].strip().rstrip(';'))

def norm(name):
    return re.sub(r'[\s\W_]+', '', unicodedata.normalize('NFKC', name).casefold())

def core(name):
    return re.sub(r'(?:股份有限责任公司|股份有限公司|有限责任公司|有限公司|有限|总公司|公司)$', '', norm(name))

def loose(name):
    return re.sub(r'(?:科技|技术|股份)', '', core(name))

def xlsx(path, sheets):
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    package = 'http://schemas.openxmlformats.org/package/2006/relationships'
    with ZipFile(path, 'w', ZIP_DEFLATED) as z:
        overrides = ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(sheets)+1))
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+overrides+'</Types>')
        z.writestr('_rels/.rels', f'<Relationships xmlns="{package}"><Relationship Id="rId1" Type="{rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>'+''.join(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>' for i,(name,_) in enumerate(sheets,1))+'</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', f'<Relationships xmlns="{package}">'+''.join(f'<Relationship Id="rId{i}" Type="{rel}/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))+'</Relationships>')
        for i,(_,rows) in enumerate(sheets,1):
            body = ''.join(f'<row r="{n}">'+''.join(f'<c r="{chr(65+j)}{n}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>' for j,v in enumerate(row))+'</row>' for n,row in enumerate(rows,1))
            z.writestr(f'xl/worksheets/sheet{i}.xml', f'<worksheet xmlns="{ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="15" width="28" customWidth="1"/></cols><sheetData>{body}</sheetData><autoFilter ref="A1:{chr(64+len(rows[0]))}{len(rows)}"/></worksheet>')

def main():
    import subprocess
    # Reuse the live website matching export so the unmatched population is current.
    result = json.loads(subprocess.check_output(['python3', str(ROOT/'tools/export_unlinked_enterprises.py')], text=True))
    with Path(result['csv']).open(encoding='utf-8-sig') as f:
        unmatched = list(csv.DictReader(f))
    payload = load('dashboard-data.js')['enterprise']
    companies = [c for c in payload['companies'] + payload.get('directoryFallbackCompanies', []) if '中国' in c.get('countries', []) and c.get('value', 0)]
    candidates = [(c, [(n,core(n),loose(n)) for n in set([c['name']]+c.get('aliases',[]))]) for c in companies]
    headers = ['原企业名称','原省份','原城市','候选排名','候选企业名称','候选省份','候选城市','候选专利族数','专利关联口径','匹配等级','名称相似度','匹配依据','命中别名','数据来源','核验意见（待填写）']
    output = [headers]; summary = [['原企业名称','省份','城市','候选数','最高匹配等级','首选候选','数据来源']]
    for source in unmatched:
        name=source['企业名称']; a=core(name); b=loose(name); ranked=[]
        for company, aliases in candidates:
            best=None
            for alias, ac, bc in aliases:
                ratio=SequenceMatcher(None,a,ac).ratio(); relaxed=SequenceMatcher(None,b,bc).ratio()
                if a==ac:
                    score=1.; reason='名称核心一致，企业组织形式或标点差异'; level='高相似待核验'
                elif b==bc and len(b)>=5:
                    score=.97; reason='移除科技、技术、股份等字样后相同'; level='高相似待核验'
                elif ratio>=.82 and len(a)>=6:
                    score=ratio; reason='名称字符近似，可能存在错字、增字或减字'; level='一般候选待核验'
                elif relaxed>=.88 and len(b)>=6:
                    score=relaxed*.95; reason='简化名称后近似'; level='一般候选待核验'
                else: continue
                provinces=company.get('provinces',[])
                same=bool(source['省份'] and any(source['省份'].removesuffix('省') in p or p.removesuffix('省') in source['省份'] for p in provinces if p))
                conflict=bool(source['省份'] and provinces and not same)
                if conflict: reason+='；省份不一致';level='地区冲突待核验'
                elif same: reason+='；省份一致'
                entry=(score + (.015 if same else -.05 if conflict else 0),score,alias,reason,level)
                if best is None or entry[0]>best[0]:best=entry
            if best:ranked.append((best,company))
        ranked.sort(key=lambda x:(-x[0][0],x[1]['name']))
        # A company may exist in both primary and fallback profile collections.
        selected=[];seen=set()
        for item in ranked:
            if item[1]['name'] in seen:continue
            selected.append(item);seen.add(item[1]['name'])
            if len(selected)==3:break
        summary.append([name,source['省份'],source['城市'],len(selected),selected[0][0][4] if selected else '暂无可靠名称候选',selected[0][1]['name'] if selected else '',source['数据来源']])
        for rank,(best,c) in enumerate(selected,1):
            output.append([name,source['省份'],source['城市'],rank,c['name'],'；'.join(c.get('provinces',[])),'；'.join(c.get('cities',[])),c['value'],c.get('profileScope','当前权利人'),best[4],round(best[1]*100,1),best[3],best[2],source['数据来源'],''])
    notes=[['项目','说明'],['范围',f'网站当前暂未关联专利企业{len(unmatched)}家'],['状态','仅生成候选；未改企业名称、专利关联或网站数据'],['相似度','字符串相似度，仅用于排序，不代表同一企业的概率'],['同音字','本轮按字符相似召回单字差异；未使用拼音库，不能穷尽同音候选'],['核验','应结合统一社会信用代码、曾用名、地址等核验；科技等字样相同不能证明同一主体'],['数量','候选专利族数按候选画像自身口径展示，未转入原企业']]
    base=ROOT/'output'/f'暂未关联专利企业_模糊匹配核验_{date.today():%Y%m%d}'
    xlsx(base.with_suffix('.xlsx'), [('企业汇总',summary),('候选匹配明细',output),('使用说明',notes)])
    with base.with_suffix('.csv').open('w',encoding='utf-8-sig',newline='') as f:csv.writer(f).writerows(output)
    print(json.dumps({'total':len(unmatched),'withCandidates':sum(r[3]>0 for r in summary[1:]),'candidateRows':len(output)-1,'topLevels':dict(Counter(r[4] for r in summary[1:])),'xlsx':str(base.with_suffix('.xlsx'))},ensure_ascii=False))

if __name__=='__main__':main()
