"""统一库逻辑备份：调用 mysqldump 导出为 gzip 压缩的 .sql.gz。

只读操作，可安全重复运行。用运行态账号（fii_runtime，见
scripts/mysql_provision_user.sql）或 root 均可，连接参数取自 .env（MYSQL_*）。
口令经临时 defaults-extra-file 传入，不出现在进程命令行里。

用法：
    python scripts/backup_mysql.py                # 备份到 backups/
    python scripts/backup_mysql.py --keep 7       # 只保留最近 7 份
    python scripts/backup_mysql.py --output-dir D:/db_backups

恢复：
    gunzip -c backups/<file>.sql.gz | mysql -u root -p
（备份含 CREATE DATABASE/USE，恢复会重建 future_industry_insight 库。）
"""
from __future__ import annotations

import argparse
import glob
import gzip
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import config  # noqa: E402


def find_mysqldump() -> str:
    override = os.environ.get("MYSQLDUMP_PATH")
    if override:
        return override
    found = shutil.which("mysqldump")
    if found:
        return found
    for pattern in (
        r"C:\Program Files\MySQL\*\bin\mysqldump.exe",
        r"C:\Program Files\MariaDB*\bin\mysqldump.exe",
        "/usr/local/mysql/bin/mysqldump",
        "/opt/homebrew/bin/mysqldump",
    ):
        matches = sorted(glob.glob(pattern))
        if matches:
            return matches[-1]
    raise SystemExit("找不到 mysqldump；请安装 MySQL 客户端工具或设置环境变量 MYSQLDUMP_PATH 指向它。")


def write_defaults_file(settings: dict) -> str:
    fd, path = tempfile.mkstemp(prefix="fii-mysqldump-", suffix=".cnf")
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write("[client]\n")
        handle.write(f"user={settings['user']}\n")
        handle.write(f"password={settings['password']}\n")
        handle.write(f"host={settings['host']}\n")
        handle.write(f"port={settings['port']}\n")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return path


def prune(directory: Path, keep: int) -> None:
    if keep <= 0:
        return
    backups = sorted(directory.glob(f"{config.MYSQL['database']}_*.sql.gz"), key=lambda p: p.stat().st_mtime)
    for stale in backups[:-keep]:
        stale.unlink(missing_ok=True)
        print(f"[backup] 删除旧备份 {stale.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="mysqldump 逻辑备份统一库为 .sql.gz")
    parser.add_argument("--output-dir", default=str(ROOT / "backups"), help="备份输出目录（默认 backups/）")
    parser.add_argument("--keep", type=int, default=0, help="只保留最近 N 份（0=不删除）")
    args = parser.parse_args()

    settings = config.MYSQL
    database = settings["database"]
    mysqldump = find_mysqldump()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    out_path = out_dir / f"{database}_{stamp}.sql.gz"
    defaults_file = write_defaults_file(settings)

    command = [
        mysqldump,
        f"--defaults-extra-file={defaults_file}",
        "--single-transaction",
        "--no-tablespaces",
        "--set-gtid-purged=OFF",
        "--databases", database,
    ]
    print(f"[backup] 导出 {config.describe_mysql()} -> {out_path}")
    try:
        with out_path.open("wb") as sink:
            with gzip.GzipFile(filename="", mode="wb", compresslevel=6, fileobj=sink) as compressor:
                process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                assert process.stdout is not None
                shutil.copyfileobj(process.stdout, compressor, length=1024 * 1024)
                process.stdout.close()
                stderr = process.stderr.read().decode(errors="replace") if process.stderr else ""
                code = process.wait()
        if code != 0:
            out_path.unlink(missing_ok=True)
            raise SystemExit(f"[backup] mysqldump 失败（退出码 {code}）：{stderr.strip()}")
        if stderr.strip():
            print(f"[backup] mysqldump 提示：{stderr.strip()}")
    finally:
        try:
            os.unlink(defaults_file)
        except OSError:
            pass

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"[backup] 完成：{out_path}（{size_mb:.1f} MB）")
    prune(out_dir, args.keep)


if __name__ == "__main__":
    main()
