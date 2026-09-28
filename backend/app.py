"""FastAPI application: static site hosting + MySQL-backed payload APIs."""
from __future__ import annotations

import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from . import auth, config, database, db, payloads

PAYLOAD_NAMES = set(payloads._ALL_NAMES)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if database.probe() is None:
        print(f"[warn] 统一库不可达: {config.describe_mysql()}", flush=True)
    missing = [str(path) for path in (config.SOURCE_XLSX, config.ENTERPRISE_XLSX, config.TOPIC_WORKBOOK) if not path.is_file()]
    if missing:
        print(f"[warn] 缺少构建输入: {missing}", flush=True)
    auth.warn_if_insecure()
    payloads.warmup_async()
    yield


app = FastAPI(title="未来产业洞见系统 API", version="1.0", lifespan=lifespan)

# 静态资源缓存策略：带版本查询参数(?v=)的资源长期 immutable 缓存（前端每次改动都换 ?v=）；
# HTML/无版本资源走 no-cache 再验证。载荷(/api/payload/*)因需鉴权且随重建变化，单独用 ETag 再验证。
_STATIC_ASSET_EXTS = (".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico", ".woff", ".woff2", ".map", ".gif")


@app.middleware("http")
async def access_log_and_static_cache(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000.0
    path = request.url.path

    if not path.startswith("/api/"):
        if request.query_params.get("v"):
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        else:
            response.headers.setdefault("Cache-Control", "no-cache")

    is_asset = path.endswith(_STATIC_ASSET_EXTS)
    if config.ACCESS_LOG and path != "/api/health" and not is_asset:
        forwarded = request.headers.get("x-forwarded-for", "")
        client = forwarded.split(",")[0].strip() or (request.client.host if request.client else "-")
        length = response.headers.get("content-length", "-")
        query = f"?{request.url.query}" if request.url.query else ""
        agent = request.headers.get("user-agent", "-")
        print(f'[access] {client} "{request.method} {path}{query}" {response.status_code} '
              f'{duration_ms:.0f}ms {length}B "{agent}"', flush=True)
    return response


@app.get("/api/health")
def health():
    version = database.probe()
    return {
        "status": "ok",
        "auth": {"enabled": auth.enabled()},
        "database": config.describe_mysql() if version else None,
        "mysqlVersion": version,
        "payloads": payloads.status(),
    }


class LoginRequest(BaseModel):
    username: str
    password: str


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, response: Response):
    if not auth.enabled():
        return {"authenticated": True, "username": None, "authEnabled": False}
    client = _client_key(request)
    remaining = auth.locked_remaining(client)
    if remaining:
        raise HTTPException(429, f"失败次数过多，请 {remaining} 秒后重试", headers={"Retry-After": str(remaining)})
    if not auth.check_credentials(body.username, body.password):
        auth.record_failure(client)
        raise HTTPException(401, "用户名或密码不正确")
    auth.clear_failures(client)
    token = auth.issue_token(body.username)
    response.set_cookie(
        auth.COOKIE_NAME,
        token,
        max_age=config.AUTH_TTL_HOURS * 3600,
        httponly=True,
        samesite="lax",
        secure=config.AUTH_COOKIE_SECURE,
        path="/",
    )
    return {"authenticated": True, "username": body.username, "authEnabled": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/session")
def session(request: Request):
    if not auth.enabled():
        return {"authenticated": True, "username": None, "authEnabled": False}
    username = auth.verify_token(request.cookies.get(auth.COOKIE_NAME))
    return {"authenticated": username is not None, "username": username, "authEnabled": True}


def require_auth(request: Request) -> None:
    if not auth.enabled():
        return
    if auth.verify_token(request.cookies.get(auth.COOKIE_NAME)) is None:
        raise HTTPException(401, "未登录或会话已过期")


@app.get("/api/payload/{name}")
def payload(name: str, request: Request):
    require_auth(request)
    if name not in PAYLOAD_NAMES:
        raise HTTPException(404, f"未知载荷: {name}")
    state = payloads.ensure(name)
    if state != "ready":
        return JSONResponse({"detail": f"载荷正在构建中: {name}"}, status_code=503, headers={"Retry-After": "10"})
    path = payloads.json_path(name)
    stat = path.stat()
    base = f"{name}-{stat.st_mtime_ns:x}-{stat.st_size:x}"
    headers = {"Vary": "Accept-Encoding", "Cache-Control": "private, max-age=0, must-revalidate"}
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
def db_meta(request: Request):
    require_auth(request)
    try:
        return db.metadata()
    except database.Error as error:
        raise HTTPException(503, f"统一库不可用: {error}")


@app.get("/api/db/stats")
def db_stats(request: Request):
    require_auth(request)
    try:
        return db.stats()
    except database.Error as error:
        raise HTTPException(503, f"统一库不可用: {error}")


@app.get("/api/db/families/{family_id}")
def db_family(family_id: str, request: Request):
    require_auth(request)
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
    uvicorn.run("backend.app:app", host=args.host, port=args.port, app_dir=str(config.ROOT), access_log=False)
