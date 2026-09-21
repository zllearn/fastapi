"""Portable handoff entry; default is validation, rebuilding requires --rebuild."""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPELINE = ROOT / "pipeline"
parser = argparse.ArgumentParser()
parser.add_argument('--rebuild', action='store_true', help='重建统一库及全部载荷；会覆盖 backend/cache')
parser.add_argument('--skip-unified', action='store_true', help='重建时复用现有统一数据库')
parser.add_argument('--shareholders-only', action='store_true', help='仅由随包核验报告重建股东前端数据')
parser.add_argument('--verify-files', action='store_true', help='逐个核对交付清单SHA256（重建后的文件允许变化，请勿用于重建后）')
args = parser.parse_args()

spec = importlib.util.spec_from_file_location('handoff_builder', PIPELINE / 'build_site.py')
builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
builder.validate_inputs()
if args.verify_files:
    records = json.loads((ROOT / 'manifest/delivery_manifest.json').read_text(encoding='utf-8'))
    bad = [r['path'] for r in records if not (ROOT / r['path']).is_file() or builder.sha256(ROOT / r['path']) != r['sha256']]
    if bad: raise SystemExit('文件缺失或变化：' + str(bad))
    print(f'完整性校验通过：{len(records)}项')
if args.rebuild:
    if importlib.util.find_spec('openpyxl') is None: raise SystemExit('请先执行 python -m pip install -r requirements/build.txt')
    sys.argv = ['build_site.py'] + (['--skip-unified'] if args.skip_unified else [])
    builder.main()
if args.rebuild or args.shareholders_only:
    builder.run('股东可能关联专利', [sys.executable, 'tools/build_shareholder_frontend.py', '--date', '20260916'])
else:
    print('检查完成，未改写任何数据。运行 python scripts/build.py --rebuild 执行重建。')
