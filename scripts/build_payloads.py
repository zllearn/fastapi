"""预构建 backend/cache 页面载荷，供上线前一次性备齐、或多 worker 启动前规避并发构建。

这里不重复实现任何聚合逻辑：逐个调用 backend/payloads.py 里登记的构建器（即
pipeline/ 下的脚本），再把 .js 转成 .json 并生成 .json.gz 旁路——与请求路径
触发的构建完全同一套代码，只是改在低峰期由运维主动跑完。

用法：
    python scripts/build_payloads.py                 # 只补缺失的载荷
    python scripts/build_payloads.py --rebuild       # 全部强制重建
    python scripts/build_payloads.py --only atlas-dashboard
    python scripts/build_payloads.py --status        # 只看状态，不写文件

注意：统一库（MySQL）必须先有数据——用 `python scripts/build.py --rebuild` 从
data/ 源表入库，或用备份恢复（见 deploy/SERVER_SETUP.md）。本脚本只产载荷。
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import config, payloads  # noqa: E402

MB = 1024 * 1024


def report(name: str, seconds: float | None = None) -> None:
    path = payloads.json_path(name)
    if not path.is_file():
        print(f"  {name}: 缺失")
        return
    gz = payloads.gzip_path(path)
    size = path.stat().st_size / MB
    gz_size = gz.stat().st_size / MB if gz.is_file() else 0
    label = f"{seconds:.0f}s" if seconds is not None else "-"
    print(f"  {name}: {size:.1f} MB -> gz {gz_size:.1f} MB（{label}）")


parser = argparse.ArgumentParser(description="预构建 backend/cache 页面载荷")
parser.add_argument("--rebuild", action="store_true", help="已存在的载荷也强制重建")
parser.add_argument("--only", help="只处理指定载荷名")
parser.add_argument("--status", action="store_true", help="只打印状态，不构建")
args = parser.parse_args()

status = payloads.status()
if args.status:
    for name in payloads._ALL_NAMES:
        print(f"  {name}: {status[name]['state']}")
    raise SystemExit(0)

names = list(payloads.BUILDERS)
if args.only:
    if args.only not in payloads.BUILDERS:
        raise SystemExit(f"未知载荷 {args.only}；可构建的：{', '.join(names)}")
    names = [args.only]

print(f"载荷目录：{config.CACHE}")
print(f"统一库：{config.describe_mysql()}")
missing_inputs = [str(p) for p in (config.SOURCE_XLSX, config.ENTERPRISE_XLSX, config.TOPIC_WORKBOOK) if not p.is_file()]
if missing_inputs:
    print(f"[warn] 缺少构建输入 Excel（重建会失败）：{missing_inputs}")

total_bytes = 0
for name in names:
    if args.rebuild and payloads.is_ready(name):
        payloads.json_path(name).unlink()
        print(f"[payload] 已清除旧缓存 {name}")
    start = time.perf_counter()
    payloads.ensure(name)
    cache_path = payloads.json_path(name)
    # ensure() 不保证旁路 .gz 存在（首次请求才会生成），这里一并备齐
    payloads.ensure_gzip(cache_path)
    total_bytes += cache_path.stat().st_size
    report(name, time.perf_counter() - start)

print("\n快照类载荷随包提供、不由本脚本构建：")
for name in payloads.SNAPSHOT_GLOBALS:
    report(name)
print(f"\n完成：{len(names)} 份可构建载荷，未压缩合计 {total_bytes / MB:.1f} MB。")
if not args.only:
    print("校验：systemctl 起服务后访问 /api/health，payloads 应全部为 ready。")
