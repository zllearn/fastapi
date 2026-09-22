#!/usr/bin/env python3
"""Export unified IncoPat simple families for the existing frontier pipeline."""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path


PIPELINE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_ROOT.parent))

from backend.database import connect  # noqa: E402

TOKEN_RE = re.compile(r"[;\n\r|]+")


def first_text(*values: object) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def citation_count(value: object) -> int:
    return len({item.strip() for item in TOKEN_RE.split(str(value or "")) if item.strip()})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)

    connection = connect()
    rows = connection.execute(
        '''
        SELECT f.family_id,
               `家族代表公开（公告）号` AS publication_number,
               `标题 (中文)` AS title_zh,
               `标题 (英文)` AS title_en,
               `摘要 (中文)` AS abstract_zh,
               `摘要 (英文)` AS abstract_en,
               `首次公开日` AS publication_date,
               `最早优先权日` AS priority_date,
               priority_year,
               `IPC` AS ipc,
               `家族被引证` AS cited_by,
               t.technical_feature,
               t.technology_code,
               t.technology_label,
               t.route_code,
               t.route_label,
               t.chain_level1,
               t.chain_level2,
               t.chain_level3
        FROM families AS f
        LEFT JOIN family_tech AS t ON t.family_id = f.family_id
        ORDER BY f.family_id
        '''
    )
    fields = [
        "Family ID", "Display Key", "Title", "Abstract", "Publication Date",
        "Cited by Patent Count", "IPCR Classifications", "Technical Feature",
        "Technology Code", "Technology Label", "Route Code", "Route Label",
        "Industry Chain Level 1", "Industry Chain Level 2", "Industry Chain Level 3",
    ]
    count = 0
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "Family ID": row["family_id"],
                "Display Key": first_text(row["publication_number"], row["family_id"]),
                "Title": first_text(row["title_en"], row["title_zh"]),
                "Abstract": first_text(row["abstract_en"], row["abstract_zh"]),
                "Publication Date": first_text(row["publication_date"], row["priority_date"], row["priority_year"]),
                "Cited by Patent Count": citation_count(row["cited_by"]),
                "IPCR Classifications": row["ipc"] or "",
                "Technical Feature": row["technical_feature"] or "",
                "Technology Code": row["technology_code"] or "",
                "Technology Label": row["technology_label"] or "",
                "Route Code": row["route_code"] or "",
                "Route Label": row["route_label"] or "",
                "Industry Chain Level 1": row["chain_level1"] or "",
                "Industry Chain Level 2": row["chain_level2"] or "",
                "Industry Chain Level 3": row["chain_level3"] or "",
            })
            count += 1
    print(f"Exported {count:,} simple patent families to {args.output}")


if __name__ == "__main__":
    main()
