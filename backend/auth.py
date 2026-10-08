"""服务端会话鉴权：HMAC 签名 Cookie 令牌 + 登录限流。

凭据来自 .env（AUTH_USERNAME / AUTH_PASSWORD）；两者任一为空即视为未启用鉴权，
所有请求放行（便于本地无凭据调试），生产部署必须配置。
令牌不依赖服务端存储，多 worker / 重启后依然有效（需固定 AUTH_SECRET）。

登录失败计数是进程内的、按客户端 IP 分桶：
- 置于 nginx 之后须置 TRUST_PROXY_HEADERS=1，否则所有用户都记在 127.0.0.1 一个桶里；
- 多 worker 下各进程独立计数（实际阈值约为 worker 数 × 5 次），所以暴力破解的兜底
  交给 nginx 的 limit_req（见 deploy/nginx/）。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import threading
import time
from collections import deque

from . import config

COOKIE_NAME = "fii_session"
_MAX_LOGIN_FAILURES = 5
_LOCKOUT_SECONDS = 300
_recent_failures: dict[str, deque] = {}
_failures_lock = threading.Lock()


def enabled() -> bool:
    return bool(config.AUTH_USERNAME and config.AUTH_PASSWORD)


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue_token(username: str) -> str:
    expires = int(time.time()) + config.AUTH_TTL_HOURS * 3600
    payload = f"{expires}:{username}".encode()
    digest = hmac.new(config.AUTH_SECRET, payload, hashlib.sha256).digest()
    return f"{_b64(payload)}.{_b64(digest)}"


def verify_token(token: str | None) -> str | None:
    if not enabled() or not token:
        return None
    body, _, signature = token.partition(".")
    if not signature:
        return None
    try:
        payload = _unb64(body)
        expected = _unb64(signature)
    except Exception:
        return None
    if not hmac.compare_digest(expected, hmac.new(config.AUTH_SECRET, payload, hashlib.sha256).digest()):
        return None
    expires, _, username = payload.decode(errors="replace").partition(":")
    if not expires.isdigit() or int(expires) < time.time():
        return None
    return username


def locked_remaining(client: str) -> int:
    """返回该客户端还需等待的锁定秒数；0 表示未锁定。"""
    if not enabled():
        return 0
    now = time.time()
    with _failures_lock:
        attempts = _recent_failures.get(client)
        if not attempts:
            return 0
        while attempts and now - attempts[0] > _LOCKOUT_SECONDS:
            attempts.popleft()
        if len(attempts) >= _MAX_LOGIN_FAILURES:
            return int(_LOCKOUT_SECONDS - (now - attempts[0])) + 1
        return 0


def record_failure(client: str) -> None:
    if not enabled():
        return
    with _failures_lock:
        _recent_failures.setdefault(client, deque()).append(time.time())


def clear_failures(client: str) -> None:
    with _failures_lock:
        _recent_failures.pop(client, None)


def check_credentials(username: str, password: str) -> bool:
    if not enabled():
        return False
    return (
        hmac.compare_digest(username, config.AUTH_USERNAME)
        and hmac.compare_digest(password, config.AUTH_PASSWORD)
    )


def describe() -> str:
    if not enabled():
        return "未配置（AUTH_USERNAME/AUTH_PASSWORD 为空，接口无鉴权）"
    source = ".env" if config.AUTH_SECRET_SOURCE == "env" else "启动时随机生成（重启后会话失效）"
    return f"已启用，用户 {config.AUTH_USERNAME}，会话 {config.AUTH_TTL_HOURS}h，密钥来源: {source}"


def warn_if_insecure() -> None:
    if enabled() and config.AUTH_SECRET_SOURCE == "random":
        print("[warn] 未设置 AUTH_SECRET，已生成随机密钥；重启后所有会话失效，多进程部署时必须固定", flush=True)
    if not enabled():
        print("[warn] 未配置 AUTH_USERNAME/AUTH_PASSWORD，/api/payload 与 /api/db 无鉴权，公网部署前必须在 .env 中设置", flush=True)
