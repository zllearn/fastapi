"""Start the FastAPI delivery server (site hosting + payload APIs)."""
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, default=8000)
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--rebuild-payloads", action="store_true", help="清空载荷缓存后由统一库重新构建")
args = parser.parse_args()

if args.rebuild_payloads:
    import shutil
    shutil.rmtree(ROOT / "server/cache", ignore_errors=True)
    print("已清空 server/cache，启动后将重建全部载荷。")

sys.path.insert(0, str(ROOT))
from server.app import main  # noqa: E402

sys.argv = ["server", "--host", args.host, "--port", str(args.port)]
main()
