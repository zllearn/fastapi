#!/usr/bin/env python3
"""Validate inputs and rebuild every static payload used by the website."""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path


INCOPAT_ROOT = Path(__file__).resolve().parent
PROJECTS_ROOT = INCOPAT_ROOT.parent
SITE_ROOT = PROJECTS_ROOT / "frontend"
DATA_ROOT = PROJECTS_ROOT / "data"
SOURCE_XLSX = DATA_ROOT / "incopat_patent_families.xlsx"
ENTERPRISE_XLSX = DATA_ROOT / "enterprise_directory.xlsx"
TOPIC_WORKBOOK = PROJECTS_ROOT / "analytics/incopat_run/incopat_simple_families_topic_indicators.xlsx"
UNIFIED_DB = INCOPAT_ROOT / "output/unified_patent_families.sqlite3"
STATIC_PAYLOADS = INCOPAT_ROOT / "output/site-payloads"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def run(label: str, command: list[str]) -> None:
    print(f"\n[{label}] {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=INCOPAT_ROOT, check=True)


def validate_inputs() -> None:
    required = {
        "正式合并专利数据": SOURCE_XLSX,
        "核验企业总名单": ENTERPRISE_XLSX,
        "前沿主题指标工作簿": TOPIC_WORKBOOK,
        "网站目录": SITE_ROOT,
        "前沿企业索引构建脚本": INCOPAT_ROOT / "build_frontier_enterprise_index.py",
    }
    missing = [f"{label}: {path}" for label, path in required.items() if not path.exists()]
    if shutil.which("node") is None:
        missing.append("Node.js: node 不在 PATH 中")
    if missing:
        raise SystemExit("缺少网站构建依赖：\n- " + "\n- ".join(missing))

    if UNIFIED_DB.is_file():
        connection = sqlite3.connect(UNIFIED_DB)
        row = connection.execute(
            "SELECT value FROM metadata WHERE key='source_xlsx_sha256'"
        ).fetchone()
        connection.close()
        recorded = str(row[0]) if row else ""
        actual = sha256(SOURCE_XLSX)
        if recorded and recorded != actual:
            raise SystemExit(
                "正式合并专利数据与当前统一数据库来源不一致：\n"
                f"- 数据库记录：{recorded}\n- 当前文件：{actual}"
            )
        print(f"主数据校验通过：{actual}")
    print("网站构建依赖检查通过。")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true", help="只检查路径、工具和主数据版本")
    parser.add_argument("--skip-unified", action="store_true", help="复用现有统一数据库")
    parser.add_argument("--skip-frontier", action="store_true", help="不重建前沿主题企业索引")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    validate_inputs()
    if args.check_only:
        return

    python = sys.executable
    STATIC_PAYLOADS.mkdir(parents=True, exist_ok=True)
    if not args.skip_unified:
        run("统一专利族数据库", [python, "build_unified_from_xlsx.py", "--input", str(SOURCE_XLSX), "--output", str(UNIFIED_DB)])
    run("企业与地理载荷", [
        python, "build_atlas_payload.py",
        "--database", str(UNIFIED_DB),
        "--enterprise-directory", str(ENTERPRISE_XLSX),
        "--output", str(STATIC_PAYLOADS / "dashboard-data.js"),
    ])
    run("技术演进载荷", [python, "build_derwent_payload_direct.py", "--database", str(UNIFIED_DB), "--output", str(STATIC_PAYLOADS / "derwent-dashboard-data.js")])
    run("企业分析载荷", ["node", "build_enterprise_insights.js"])
    run("核验企业名录", [python, "build_enterprise_directory_master.py", str(ENTERPRISE_XLSX), str(STATIC_PAYLOADS / "enterprise-directory-master.js")])
    if not args.skip_frontier:
        run("前沿主题企业索引", [python, str(INCOPAT_ROOT / "build_frontier_enterprise_index.py"), "--workbook", str(TOPIC_WORKBOOK), "--database", str(UNIFIED_DB), "--output", str(STATIC_PAYLOADS / "topic-enterprise-index.js")])
    run("独立页面校验", [python, "sync_site_pages.py", "--site", str(SITE_ROOT)])
    print("\n网站静态数据构建完成。")


if __name__ == "__main__":
    main()
