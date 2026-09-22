"""Migrate the delivered unified SQLite database into MySQL.

Read-only against the .sqlite3 file; writes the schema defined in
``backend/schema.py`` into the configured MySQL database.

    python scripts/migrate_sqlite_to_mysql.py --reset   # drop & rebuild, then load
    python scripts/migrate_sqlite_to_mysql.py --verify-only
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import config, database, schema  # noqa: E402

DEFAULT_SQLITE = ROOT / "pipeline/output/unified_patent_families.sqlite3"
# Wide tables carry long TEXT columns, so keep their multi-row INSERT small
# enough to stay well under max_allowed_packet.
WIDE_TABLES = {"families", "family_applicant_geographies"}


def batch_size(table: str) -> int:
    return 1000 if table in WIDE_TABLES else 5000


def mysql_columns(connection: database.Connection, table: str) -> list[str]:
    rows = connection.execute(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS"
        " WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s ORDER BY ORDINAL_POSITION",
        (table,),
    )
    return [row[0] for row in rows]


def copy_table(
    source: sqlite3.Connection,
    target: database.Connection,
    table: str,
) -> tuple[int, int]:
    columns = mysql_columns(target, table)
    quoted = ", ".join(f"`{name}`" for name in columns)
    placeholders = ", ".join(["%s"] * len(columns))

    sqlite_names = {row[1] for row in source.execute(f'PRAGMA table_info("{table}")')}
    missing = [name for name in columns if name not in sqlite_names]
    if missing:
        raise SystemExit(f"{table}: SQLite 源表缺少列 {missing}，schema 与源库不一致")

    insert_sql = f"INSERT INTO `{table}` ({quoted}) VALUES ({placeholders})"
    selected = ", ".join('"' + name + '"' for name in columns)
    select_sql = f'SELECT {selected} FROM "{table}"'
    size = batch_size(table)

    started = time.time()
    written = 0
    batch: list[tuple] = []
    for row in source.execute(select_sql):
        batch.append(row)
        if len(batch) >= size:
            target.executemany(insert_sql, batch)
            written += len(batch)
            batch = []
    if batch:
        target.executemany(insert_sql, batch)
        written += len(batch)
    target.commit()

    actual = target.execute(f"SELECT COUNT(*) FROM `{table}`").fetchone()[0]
    print(f"  {table:<32} {written:>7} 行  用时 {time.time() - started:5.1f}s", flush=True)
    if actual != written:
        raise SystemExit(f"{table}: 写入 {written} 行，表内却有 {actual} 行")
    return written, actual


def verify(source: sqlite3.Connection, target: database.Connection) -> bool:
    ok = True
    print("\n[校验] 行数比对", flush=True)
    for table in schema.TABLE_ORDER:
        src = source.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        dst = target.execute(f"SELECT COUNT(*) FROM `{table}`").fetchone()[0]
        flag = "ok" if src == dst else "MISMATCH"
        if src != dst:
            ok = False
        print(f"  {table:<32} sqlite={src:>7} mysql={dst:>7}  {flag}", flush=True)

    print("\n[校验] 外键孤儿行", flush=True)
    orphans = schema.find_orphans(target)
    if orphans:
        ok = False
        print(f"  发现孤儿行: {orphans}", flush=True)
    else:
        print("  无孤儿行", flush=True)

    print("\n[校验] 中文内容往返一致（最长值逐字比对）", flush=True)
    probes = [
        ("families", "当前权利人", "SELECT \"当前权利人\" FROM families ORDER BY LENGTH(\"当前权利人\") DESC LIMIT 1"),
        ("entities", "representative_name", "SELECT representative_name FROM entities ORDER BY LENGTH(representative_name) DESC LIMIT 1"),
        ("family_tech", "rationale", "SELECT rationale FROM family_tech ORDER BY LENGTH(rationale) DESC LIMIT 1"),
        ("owner_name_locations", "owner_name", "SELECT owner_name FROM owner_name_locations ORDER BY LENGTH(owner_name) DESC LIMIT 1"),
    ]
    for table, column, source_query in probes:
        expected = source.execute(source_query).fetchone()[0]
        actual = target.execute(
            f"SELECT `{column}` FROM `{table}` ORDER BY CHAR_LENGTH(`{column}`) DESC LIMIT 1"
        ).fetchone()[0]
        same = expected == actual
        if not same:
            ok = False
            print(f"  {table}.{column}: 不一致 {expected!r} != {actual!r}", flush=True)
        else:
            print(f"  {table}.{column}: 一致（{len(expected or '')} 字符）", flush=True)

    print("\n[校验] 视图", flush=True)
    for view in schema.VIEW_NAMES:
        src = source.execute(f"SELECT COUNT(*) FROM {view}").fetchone()[0]
        dst = target.execute(f"SELECT COUNT(*) FROM `{view}`").fetchone()[0]
        flag = "ok" if src == dst else "MISMATCH"
        if src != dst:
            ok = False
        print(f"  {view:<32} sqlite={src:>7} mysql={dst:>7}  {flag}", flush=True)
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, default=DEFAULT_SQLITE)
    parser.add_argument("--reset", action="store_true", help="先删表再按 schema 重建")
    parser.add_argument("--verify-only", action="store_true", help="只做比对，不写入")
    args = parser.parse_args()

    if not args.sqlite.is_file():
        raise SystemExit(f"找不到 SQLite 源库: {args.sqlite}")
    print(f"源库: {args.sqlite}  ({args.sqlite.stat().st_size / 1024 / 1024:.0f} MB)")
    print(f"目标: {config.describe_mysql()}", flush=True)

    source = sqlite3.connect(f"file:{args.sqlite}?mode=ro", uri=True)
    database.ensure_database()
    target = database.connect()
    target.run(["SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'"])

    if args.reset:
        print("\n[建表] 删除并重建 schema", flush=True)
        target.run(schema.drop_statements())
        target.run(schema.create_statements())
        target.commit()

    if not args.verify_only:
        target.run(["SET SESSION FOREIGN_KEY_CHECKS=0", "SET SESSION UNIQUE_CHECKS=0"])
        print("\n[搬运]", flush=True)
        total = 0
        for table in schema.TABLE_ORDER:
            total += copy_table(source, target, table)[0]
        target.run(["SET SESSION FOREIGN_KEY_CHECKS=1", "SET SESSION UNIQUE_CHECKS=1"])
        target.commit()
        print(f"\n合计写入 {total} 行，开始校验", flush=True)

    ok = verify(source, target)
    target.close()
    source.close()
    if not ok:
        raise SystemExit("校验未通过，请检查上方输出")
    print("\n迁移完成并通过全部校验。", flush=True)


if __name__ == "__main__":
    main()
