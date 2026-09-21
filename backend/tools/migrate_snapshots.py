"""One-off migration: extract upstream snapshot payloads out of the static site.

Produces backend/snapshots/{frontier-dashboard,verified-events,world-map}.json
from the current delivery files. Run before the HTML pages are switched to the
API; afterwards the original files remain as the archival source of these
snapshot datasets (they have no builder code in this package).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from backend import config, payloads  # noqa: E402


def frontier_dashboard() -> None:
    html = (config.FRONTEND / "frontier.html").read_text(encoding="utf-8")
    match = re.search(r'<script id="dashboard-data" type="application/json">(.*?)</script>', html, re.S)
    if not match:
        found = (config.SNAPSHOTS / "frontier-dashboard.json").is_file()
        print("frontier-dashboard: 页面中未找到内联 JSON；" + ("快照已存在，跳过" if found else "缺失！"))
        return
    payload = json.loads(match.group(1))
    out = config.SNAPSHOTS / "frontier-dashboard.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"frontier-dashboard: {out.stat().st_size:,} bytes, topics={len(payload.get('topics', []))}")


def from_js(js_file: Path, out_name: str) -> None:
    globals_ = payloads.extract_globals(js_file.read_text(encoding="utf-8"))
    if len(globals_) != 1:
        raise SystemExit(f"{js_file} 期望单一全局变量，实际 {list(globals_)}")
    out = config.SNAPSHOTS / f"{out_name}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(next(iter(globals_.values())), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{out_name}: {out.stat().st_size:,} bytes")


def world_map() -> None:
    globals_ = payloads.extract_globals((config.FRONTEND / "assets/derwent/data/map-data.js").read_text(encoding="utf-8"))
    out = config.SNAPSHOTS / "world-map.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(globals_, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"world-map: {out.stat().st_size:,} bytes, globals={list(globals_)}")


if __name__ == "__main__":
    frontier_dashboard()
    from_js(config.FRONTEND / "assets/intelligence/verified-events.js", "verified-events")
    world_map()
