"""Live read-only access to the unified SQLite database."""
from __future__ import annotations

import sqlite3

from . import config


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{config.UNIFIED_DB}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def metadata() -> dict:
    with connect() as connection:
        return dict(connection.execute("SELECT key, value FROM metadata"))


def stats() -> dict:
    with connect() as connection:
        counts = {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("families", "family_tech", "entities", "family_entities", "family_applicants")
        }
        years = connection.execute(
            "SELECT MIN(priority_year), MAX(priority_year) FROM families WHERE priority_year IS NOT NULL"
        ).fetchone()
        quality = [dict(row) for row in connection.execute("SELECT * FROM quality_metrics")]
    return {"tables": counts, "priorityYearRange": [years[0], years[1]], "qualityMetrics": quality}


def family_detail(family_id: str) -> dict | None:
    with connect() as connection:
        row = connection.execute("SELECT * FROM v_family_complete WHERE family_id=?", (family_id,)).fetchone()
        if row is None:
            return None
        entities = [dict(e) for e in connection.execute(
            "SELECT entity_name, enterprise_type, entity_source FROM family_entities WHERE family_id=? ORDER BY entity_order",
            (family_id,))]
    detail = dict(row)
    detail["currentOwnerEntities"] = entities
    return detail
