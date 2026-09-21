"""Serve only the public site, never source workbooks or shareholder reports."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8000)
args=parser.parse_args()
site=Path(__file__).resolve().parent/'未来产业洞见系统demo'
print(f'打开 http://127.0.0.1:{args.port}/index.html ；Ctrl+C停止',flush=True)
ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(site))).serve_forever()
