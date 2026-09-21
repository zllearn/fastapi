"""Central paths for the FastAPI delivery server."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "未来产业洞见系统demo"
INCOPAT = ROOT / "incopat"
INPUTS = ROOT / "inputs"

SOURCE_XLSX = INPUTS / "IncoPat筛选维度后_已回填企业类型及国家及技术标签.xlsx"
ENTERPRISE_XLSX = INPUTS / "中国核聚变相关企业总名单_去重核验版.xlsx"
TOPIC_WORKBOOK = INCOPAT.parent / "fusion_weak_signal/incopat_run/incopat_simple_families_topic_indicators.xlsx"
UNIFIED_DB = INCOPAT / "output/统一专利族数据.sqlite3"
SHAREHOLDER_STAMP = "20260916"

CACHE = Path(__file__).resolve().parent / "cache"
SNAPSHOTS = Path(__file__).resolve().parent / "snapshots"
