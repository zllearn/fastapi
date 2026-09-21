#!/usr/bin/env python3
"""Validate the standalone pages used by the site router.

The delivery site no longer embeds dashboard HTML inside ``index.html``.
Each module is maintained as an independent page and ``index.html`` only
routes to it.
"""

from __future__ import annotations

import argparse
from pathlib import Path


PAGES = {
    "home": "home.html",
    "technology": "technology.html",
    "industry": "industry.html",
    "enterprise": "enterprise.html",
    "frontier": "frontier.html",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()
    problems: list[str] = []
    for module, filename in PAGES.items():
        path = args.site / filename
        if not path.is_file():
            problems.append(f"missing: {filename}")
            continue
        html = path.read_text(encoding="utf-8")
        if f'data-module="{module}"' not in html:
            problems.append(f"invalid module marker: {filename}")

    index_path = args.site / "index.html"
    if not index_path.is_file():
        problems.append("missing: index.html")
    else:
        source = index_path.read_text(encoding="utf-8")
        if "PAGE_HTML" in source or "srcdoc" in source:
            problems.append("index.html still contains embedded page HTML")

    if problems:
        raise SystemExit("Standalone page validation failed:\n- " + "\n- ".join(problems))
    print("Standalone pages ready: " + ", ".join(PAGES.values()))


if __name__ == "__main__":
    main()
