"""Central paths for the FastAPI delivery backend."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
PIPELINE = ROOT / "pipeline"
DATA = ROOT / "data"

SOURCE_XLSX = DATA / "incopat_patent_families.xlsx"
ENTERPRISE_XLSX = DATA / "enterprise_directory.xlsx"
SHAREHOLDER_REVIEW_XLSX = DATA / "shareholder_review.xlsx"
TOPIC_WORKBOOK = ROOT / "analytics/incopat_run/incopat_simple_families_topic_indicators.xlsx"
UNIFIED_DB = PIPELINE / "output/unified_patent_families.sqlite3"
SHAREHOLDER_STAMP = "20260916"

CACHE = Path(__file__).resolve().parent / "cache"
SNAPSHOTS = Path(__file__).resolve().parent / "snapshots"
