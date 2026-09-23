"""Regenerate manifest/delivery_manifest.json and .csv with SHA256 per file."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = {".git", "__pycache__", "cache"}
EXCLUDE_FILES = {Path("manifest/delivery_manifest.json"), Path("manifest/delivery_manifest.csv"), Path(".env")}
# 统一库已迁至 MySQL，遗留的 .sqlite3 中间产物不属于交付内容
EXCLUDE_SUFFIXES = {".sqlite3", ".tmp", ".pyc", ".gz"}
PURPOSES = [
    (".html", "前端页面"), (".css", "前端样式"), (".js", "前端/构建代码"),
    (".py", "构建/服务代码"), (".md", "文档"), (".json", "数据或配置"),
    (".csv", "核验报告"), (".xlsx", "源数据"),
    (".txt", "依赖清单"), (".png", "图片资源"), (".jpg", "图片资源"),
    (".svg", "图片资源"), (".woff2", "字体资源"), (".woff", "字体资源"),
]


def purpose(rel: Path) -> str:
    if rel.parts[0] == "frontend":
        return "前端资源" if rel.suffix in {".png", ".jpg", ".svg", ".webp"} else "前端代码/页面"
    if rel.parts[0] == "backend":
        return "后端服务代码" if rel.suffix == ".py" else "快照/数据"
    if rel.parts[0] == "pipeline":
        return "构建脚本" if rel.suffix in {".py", ".js"} else "构建产物/报告"
    if rel.parts[0] == "analytics":
        return "主题分析代码/产物"
    if rel.parts[0] == "data":
        return "源数据"
    for suffix, label in PURPOSES:
        if rel.name.endswith(suffix):
            return label
    return "项目文件"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


records = []
for path in sorted(ROOT.rglob("*")):
    rel = path.relative_to(ROOT)
    if not path.is_file() or set(rel.parts[:-1]) & EXCLUDE_DIRS or rel in EXCLUDE_FILES or rel.suffix in EXCLUDE_SUFFIXES:
        continue
    records.append({
        "path": rel.as_posix(),
        "purpose": purpose(rel),
        "source": "包内相对路径",
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    })

(ROOT / "manifest").mkdir(exist_ok=True)
(ROOT / "manifest/delivery_manifest.json").write_text(
    json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
with (ROOT / "manifest/delivery_manifest.csv").open("w", newline="", encoding="utf-8-sig") as stream:
    writer = csv.DictWriter(stream, fieldnames=list(records[0]))
    writer.writeheader()
    writer.writerows(records)
print(json.dumps({"files": len(records), "bytes": sum(r["bytes"] for r in records)}, ensure_ascii=False))
