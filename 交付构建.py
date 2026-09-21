"""Portable handoff entry; default is validation, rebuilding requires --rebuild."""
import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent
INCOPAT=ROOT/'incopat'
SITE=ROOT/'未来产业洞见系统demo'
parser=argparse.ArgumentParser()
parser.add_argument('--rebuild',action='store_true',help='重建统一库及网站动态数据；会覆盖包内静态载荷')
parser.add_argument('--skip-unified',action='store_true',help='重建时复用此前在交付包中生成的数据库')
parser.add_argument('--shareholders-only',action='store_true',help='仅由随包核验报告重建股东前端数据')
parser.add_argument('--verify-files',action='store_true',help='逐个核对交付清单SHA256（重建后的文件允许变化，请勿用于重建后）')
args=parser.parse_args()

spec=importlib.util.spec_from_file_location('handoff_builder',INCOPAT/'build_site.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
builder.WINDOWS_DATA_ROOT=ROOT/'inputs'
builder.SOURCE_XLSX=ROOT/'inputs/IncoPat筛选维度后_已回填企业类型及国家及技术标签.xlsx'
builder.ENTERPRISE_XLSX=ROOT/'inputs/中国核聚变相关企业总名单_去重核验版.xlsx'
builder.validate_inputs()
if args.verify_files:
    records=json.loads((ROOT/'文件清单.json').read_text(encoding='utf-8'))
    bad=[r['path'] for r in records if not (ROOT/r['path']).is_file() or builder.sha256(ROOT/r['path'])!=r['sha256']]
    if bad:raise SystemExit('文件缺失或变化：'+str(bad))
    print(f'完整性校验通过：{len(records)}项')
if args.rebuild:
    if importlib.util.find_spec('openpyxl') is None:raise SystemExit('请先执行 python -m pip install -r requirements-build.txt')
    sys.argv=['build_site.py']+(['--skip-unified'] if args.skip_unified else [])
    builder.main()
if args.rebuild or args.shareholders_only:
    builder.run('股东可能关联专利', [sys.executable,'tools/build_shareholder_frontend.py','--date','20260916'])
else:
    print('检查完成，未改写网站。运行 python 交付构建.py --rebuild 执行重建。')
