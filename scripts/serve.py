"""Start the FastAPI delivery server (frontend hosting + payload APIs)."""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def start() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--workers", type=int, default=1, help="uvicorn 进程数（服务器部署建议 2-4）")
    parser.add_argument("--rebuild-payloads", action="store_true", help="清空载荷缓存后由统一库重新构建")
    args = parser.parse_args()

    if args.rebuild_payloads:
        import shutil
        shutil.rmtree(ROOT / "backend/cache", ignore_errors=True)
        print("已清空 backend/cache，启动后将重建全部载荷。")

    if args.workers > 1:
        print(f"多进程模式（{args.workers} worker）：需固定 .env 的 AUTH_SECRET，"
              "并建议先执行 python scripts/build.py --rebuild 预构建载荷。", flush=True)

    sys.path.insert(0, str(ROOT))
    from backend.app import main

    # backend.app.main() 自带解析，这里重写 argv 把端口/进程数转交它，保持单一启动实现
    sys.argv = ["backend", "--host", args.host, "--port", str(args.port), "--workers", str(args.workers)]
    main()


if __name__ == "__main__":
    # uvicorn --workers 在 Windows 上用 multiprocessing spawn 重新导入本文件；
    # 没有这层守卫会递归再启动一次服务（子进程反复 self-spawn）。
    start()
