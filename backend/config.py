"""Central paths and MySQL connection settings for the delivery backend."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PIPELINE = ROOT / "pipeline"
DATA = ROOT / "data"

SOURCE_XLSX = DATA / "incopat_patent_families.xlsx"
ENTERPRISE_XLSX = DATA / "enterprise_directory.xlsx"
SHAREHOLDER_REVIEW_XLSX = DATA / "shareholder_review.xlsx"
TOPIC_WORKBOOK = ROOT / "analytics/incopat_run/incopat_simple_families_topic_indicators.xlsx"
SHAREHOLDER_STAMP = "20260916"

CACHE = Path(__file__).resolve().parent / "cache"
SNAPSHOTS = Path(__file__).resolve().parent / "snapshots"


def _load_dotenv(path: Path) -> None:
    """Populate os.environ from a KEY=VALUE file without overriding real env vars."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(ROOT / ".env")

MYSQL = {
    "host": os.environ.get("MYSQL_HOST", "127.0.0.1"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", "root"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "future_industry_insight"),
    "charset": "utf8mb4",
}


def describe_mysql() -> str:
    return f"mysql://{MYSQL['user']}@{MYSQL['host']}:{MYSQL['port']}/{MYSQL['database']}"
