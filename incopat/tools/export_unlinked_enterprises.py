"""Export the website's unlinked directory records without changing source data."""
import csv
import json
import subprocess
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT.parent / '未来产业洞见系统demo'
script = r'''
const fs=require('fs'),vm=require('vm');
const c={window:{echarts:{}}};vm.createContext(c);
for(const f of ['assets/atlas/data/dashboard-data.js','assets/atlas/data/enterprise-directory-master.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),c);
let s=fs.readFileSync('assets/atlas/enterprise-directory.js','utf8');
const marker=s.indexOf('  const numberFormat');
if(marker<0)throw Error('Directory matching boundary changed; review exporter.');
vm.runInContext(s.slice(0,marker)+' globalThis.result=companies;})();',c);
console.log(JSON.stringify(c.result.filter(x=>!x.directoryMatched)));
'''
records = json.loads(subprocess.check_output(['node', '-e', script], cwd=SITE, text=True))
assert all(not r.get('patents') and not r.get('directoryValue') for r in records)
records.sort(key=lambda r: r.get('directoryName') or r['name'])
headers = ['序号', '企业名称', '国家/地区', '省份', '城市', '数据来源', '核验状态', '企业别名', '网站关联专利族数', '关联状态']
rows = [headers] + [[i, r.get('directoryName') or r['name'], '；'.join(r.get('countries', [])),
    '；'.join(r.get('provinces', [])), '；'.join(r.get('cities', [])), r.get('directorySource', ''),
    r.get('directoryVerificationStatus', ''), '；'.join(r.get('directoryAliases', [])), 0, '暂未关联专利']
    for i, r in enumerate(records, 1)]
base = ROOT / 'output' / f'暂未关联专利企业名单_{date.today():%Y%m%d}'
base.parent.mkdir(parents=True, exist_ok=True)
with base.with_suffix('.csv').open('w', encoding='utf-8-sig', newline='') as f:
    csv.writer(f).writerows(rows)

ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
sheet_rows = []
for number, row in enumerate(rows, 1):
    cells = []
    for col, value in enumerate(row):
        ref = f'{chr(65+col)}{number}'
        if isinstance(value, int):
            cells.append(f'<c r="{ref}"><v>{value}</v></c>')
        else:
            cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value or ""))}</t></is></c>')
    sheet_rows.append(f'<row r="{number}">'+''.join(cells)+'</row>')
with ZipFile(base.with_suffix('.xlsx'), 'w', ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    z.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="暂未关联专利企业" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{ns}"><dimension ref="A1:J{len(rows)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="48" customWidth="1"/><col min="3" max="5" width="18" customWidth="1"/><col min="6" max="8" width="40" customWidth="1"/><col min="9" max="10" width="22" customWidth="1"/></cols><sheetData>'+''.join(sheet_rows)+f'</sheetData><autoFilter ref="A1:J{len(rows)}"/></worksheet>')
with ZipFile(base.with_suffix('.xlsx')) as z:
    assert z.testzip() is None
print(json.dumps({'count': len(records), 'xlsx': str(base.with_suffix('.xlsx')), 'csv': str(base.with_suffix('.csv'))}, ensure_ascii=False))
