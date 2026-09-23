"""FastAPI application: static site hosting + MySQL-backed payload APIs."""
from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response

from . import config, database, db, payloads

PAYLOAD_NAMES = set(payloads._ALL_NAMES)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if database.probe() is None:
        print(f"[warn] 统一库不可达: {config.describe_mysql()}", flush=True)
    missing = [str(path) for path in (config.SOURCE_XLSX, config.ENTERPRISE_XLSX, config.TOPIC_WORKBOOK) if not path.is_file()]
    if missing:
        print(f"[warn] 缺少构建输入: {missing}", flush=True)
    payloads.warmup_async()
    yield


app = FastAPI(title="未来产业洞见系统 API", version="1.0", lifespan=lifespan)


@app.get("/api/health")
def health():
    version = database.probe()
    return {
        "status": "ok",
        "database": config.describe_mysql() if version else None,
        "mysqlVersion": version,
        "payloads": payloads.status(),
    }


@app.get("/api/payload/{name}")
def payload(name: str, request: Request):
    if name not in PAYLOAD_NAMES:
        raise HTTPException(404, f"未知载荷: {name}")
    state = payloads.ensure(name)
    if state != "ready":
        return JSONResponse({"detail": f"载荷正在构建中: {name}"}, status_code=503, headers={"Retry-After": "10"})
    path = payloads.json_path(name)
    stat = path.stat()
    base = f"{name}-{stat.st_mtime_ns:x}-{stat.st_size:x}"
    headers = {"Vary": "Accept-Encoding"}
    serve_gzip = "gzip" in request.headers.get("accept-encoding", "").lower()
    if serve_gzip:
        etag = f'"{base}-gz"'
        body = payloads.ensure_gzip(path)
        headers["Content-Encoding"] = "gzip"
    else:
        etag = f'"{base}"'
        body = path
    headers["ETag"] = etag
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return FileResponse(body, media_type="application/json", headers=headers)


@app.get("/api/db/meta")
def db_meta():
    try:
        return db.metadata()
    except database.Error as error:
        raise HTTPException(503, f"统一库不可用: {error}")


@app.get("/api/db/stats")
def db_stats():
    try:
        return db.stats()
    except database.Error as error:
        raise HTTPException(503, f"统一库不可用: {error}")


@app.get("/api/db/families/{family_id}")
def db_family(family_id: str):
    try:
        detail = db.family_detail(family_id)
    except database.Error as error:
        raise HTTPException(503, f"统一库不可用: {error}")
    if detail is None:
        raise HTTPException(404, "专利族不存在")
    return detail


# Static hosting last so /api/* wins. Only the public site directory is exposed.
app.mount("/", __import__("fastapi.staticfiles", fromlist=["StaticFiles"]).StaticFiles(directory=str(config.FRONTEND), html=True), name="site")


def main() -> None:
    import uvicorn
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print(f"打开 http://{args.host}:{args.port}/index.html ；Ctrl+C停止", flush=True)
    uvicorn.run("backend.app:app", host=args.host, port=args.port, app_dir=str(config.ROOT))
