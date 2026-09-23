"""Payload registry: run the delivered builders into a server-side JSON cache.

Each payload is served from ``backend/cache/<name>.json`` (builder-derived) or
``backend/snapshots/<name>.json`` (upstream snapshot data without build code).
Builder-derived caches are produced by re-running the original pipeline
builders against the unified MySQL database, then stripping the
``window.GLOBAL=...;`` wrapper.
"""
from __future__ import annotations

import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from . import config

_GLOBAL_ASSIGN = re.compile(r"window\.([A-Za-z_$][\w$]*)\s*=")
_DECODER = json.JSONDecoder()


def extract_globals(js_text: str) -> dict[str, object]:
    """Parse one or more ``window.NAME=<json>;`` assignments from a JS file."""
    values: dict[str, object] = {}
    for match in _GLOBAL_ASSIGN.finditer(js_text):
        start = js_text.find(match.group(0)) + len(match.group(0))
        while start < len(js_text) and js_text[start] in " \t\r\n":
            start += 1
        value, end = _DECODER.raw_decode(js_text, start)
        values[match.group(1)] = value
        js_text = js_text[: start] + "\0" * (end - start) + js_text[end:]
    return values


def write_json_from_js(js_path: Path, json_path: Path) -> list[str]:
    values = extract_globals(js_path.read_text(encoding="utf-8"))
    if not values:
        raise RuntimeError(f"{js_path} 中未找到 window.GLOBAL= 赋值")
    if len(values) == 1:
        payload = next(iter(values.values()))
    else:
        payload = values  # multi-global snapshot (e.g. world map GeoJSONs)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = json_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(json_path)
    ensure_gzip(json_path)
    return list(values)


def gzip_path(json_path: Path) -> Path:
    return json_path.with_name(json_path.name + ".gz")


def ensure_gzip(json_path: Path) -> Path:
    """Return the pre-compressed sidecar, (re)generating it when stale.

    Bandwidth is the bottleneck for remote access; payloads compress ~4:1.
    Compression happens at build time so no request ever pays it, and the
    atomic replace keeps concurrent readers on either the old or new file.
    """
    gz = gzip_path(json_path)
    source = json_path.stat()
    if gz.is_file():
        compressed = gz.stat()
        if compressed.st_size > 0 and int(compressed.st_mtime) >= int(source.st_mtime):
            return gz
    tmp = gz.with_name(gz.name + ".tmp")
    with json_path.open("rb") as src, tmp.open("wb") as dst:
        with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=dst) as out:
            shutil.copyfileobj(src, out, length=16 * 1024 * 1024)
    os.replace(tmp, gz)
    return gz


PY = sys.executable

# name -> {command producing the .js, dependencies, primary global for docs}
# The builders read the unified MySQL database from backend/config.py (.env).
BUILDERS: dict[str, dict] = {
    "atlas-dashboard": {
        "global": "DASHBOARD_DATA",
        "js": config.CACHE / "atlas-dashboard.js",
        "command": [PY, str(config.PIPELINE / "build_atlas_payload.py"),
                    "--enterprise-directory", str(config.ENTERPRISE_XLSX),
                    "--output", "{js}"],
        "cwd": str(config.PIPELINE),
    },
    "derwent-dashboard": {
        "global": "FUSION_DASHBOARD_DATA",
        "js": config.CACHE / "derwent-dashboard.js",
        "command": [PY, str(config.PIPELINE / "build_derwent_payload_direct.py"),
                    "--output", "{js}"],
        "cwd": str(config.PIPELINE),
    },
    "enterprise-insights": {
        "global": "ENTERPRISE_INSIGHTS",
        "js": config.CACHE / "enterprise-insights.js",
        "command": ["node", str(config.ROOT / "backend/tools/build_enterprise_insights.js"),
                    str(config.CACHE / "atlas-dashboard.js"), "{js}"],
        "cwd": str(config.PIPELINE),
        "depends_on": ["atlas-dashboard"],
    },
    "enterprise-directory": {
        "global": "ENTERPRISE_DIRECTORY_MASTER",
        "js": config.CACHE / "enterprise-directory.js",
        "command": [PY, str(config.PIPELINE / "build_enterprise_directory_master.py"),
                    str(config.ENTERPRISE_XLSX), "{js}"],
        "cwd": str(config.PIPELINE),
    },
    "shareholder-leads": {
        "global": "SHAREHOLDER_LEADS",
        "js": config.CACHE / "shareholder-leads.js",
        "command": [PY, str(config.ROOT / "backend/tools/build_shareholder_frontend.py"),
                    "--date", config.SHAREHOLDER_STAMP, "--output", "{js}"],
        "cwd": str(config.PIPELINE),
    },
    "frontier-index": {
        "global": "FRONTIER_ENTERPRISE_INDEX",
        "js": config.CACHE / "frontier-index.js",
        "command": [PY, str(config.PIPELINE / "build_frontier_enterprise_index.py"),
                    "--workbook", str(config.TOPIC_WORKBOOK),
                    "--output", "{js}"],
        "cwd": str(config.PIPELINE),
    },
}

# Upstream snapshots without build code in this package: stored directly as JSON.
SNAPSHOT_GLOBALS = {
    "frontier-dashboard": "FRONTIER_DASHBOARD_DATA",
    "verified-events": "FUSION_VERIFIED_EVENTS",
    "world-map": None,  # object mapping global names to values
}

_ALL_NAMES = list(BUILDERS) + list(SNAPSHOT_GLOBALS)
_locks: dict[str, threading.Lock] = {name: threading.Lock() for name in _ALL_NAMES}
_building: set[str] = set()
_building_guard = threading.Lock()


def json_path(name: str) -> Path:
    if name in BUILDERS:
        return config.CACHE / f"{name}.json"
    return config.SNAPSHOTS / f"{name}.json"


def snapshot_path(name: str) -> Path:
    return config.SNAPSHOTS / f"{name}.json"


def is_ready(name: str) -> bool:
    return json_path(name).is_file()


def is_building(name: str) -> bool:
    with _building_guard:
        return name in _building


def build(name: str) -> None:
    """Run the builder chain for one payload and refresh its JSON cache."""
    spec = BUILDERS[name]
    for dependency in spec.get("depends_on", []):
        if not is_ready(dependency):
            build(dependency)
    with _building_guard:
        _building.add(name)
    try:
        js = Path(spec["js"])
        command = [part.replace("{js}", str(js)) for part in spec["command"]]
        subprocess.run(command, cwd=spec["cwd"], check=True)
        write_json_from_js(js, json_path(name))
    finally:
        with _building_guard:
            _building.discard(name)


def ensure(name: str) -> str:
    """Return cache state for a payload: ready / building / missing."""
    if is_ready(name):
        return "ready"
    if name in SNAPSHOT_GLOBALS:
        return "missing"  # snapshots ship with the server; never built here
    if is_building(name):
        return "building"
    with _locks[name]:
        if not is_ready(name):
            build(name)
    return "ready"


def warmup_async() -> None:
    def worker() -> None:
        for name in BUILDERS:
            if is_ready(name):
                continue
            try:
                ensure(name)
                print(f"[payload] 预热完成 {name}", flush=True)
            except Exception as error:  # keep other payloads usable
                print(f"[payload] 预热失败 {name}: {error}", flush=True)
    threading.Thread(target=worker, name="payload-warmup", daemon=True).start()


def status() -> dict:
    result = {}
    for name in _ALL_NAMES:
        path = json_path(name)
        if path.is_file():
            import os
            stat = path.stat()
            result[name] = {"state": "ready", "bytes": stat.st_size, "mtime": stat.st_mtime}
        elif name in SNAPSHOT_GLOBALS:
            result[name] = {"state": "missing"}
        elif is_building(name):
            result[name] = {"state": "building"}
        else:
            result[name] = {"state": "stale-or-missing"}
    return result
