"""Shareholder payload builder writing to an explicit output path (server copy)."""
import argparse
import csv
import json
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parents[2] / "incopat" / "tools"
sys.path.insert(0, str(TOOLS_DIR))
sys.path.insert(0, str(TOOLS_DIR.parent))

from fuzzy_match_unlinked_enterprises import ROOT  # noqa: E402  (incopat/)
from build_atlas_payload import read_xlsx_rows  # noqa: E402


def build(stamp, target):
    base = ROOT / "output" / f"股东发明人专利关联_待核验_{stamp}"

    def read(suffix):
        with Path(str(base) + suffix + ".csv").open(encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))

    summaries = read("_企业汇总")
    details = read("_关联明细")
    all_rows = read_xlsx_rows(base.with_suffix(".xlsx"), "全部结果企业统计")
    companies = {r[0]: dict(name=r[0], code=r[1], mappings=[], patents={}) for r in all_rows[1:]}
    for r in summaries:
        name = r["结果表企业名称"]
        c = companies.setdefault(name, dict(name=name, code=r["统一社会信用代码"], mappings=[], patents={}))
        c["mappings"].append(dict(name=r["网站原企业名称"], method=r["名称对应口径"]))
    for r in details:
        c = companies.get(r["企业名称"])
        if not c:
            continue
        p = c["patents"].setdefault(r["专利族ID"], dict(
            family=r["专利族ID"], id=r["代表公开号"], title=r["专利标题"],
            inventors=r["发明人"], applicant=r["申请人"], owner=r["当前权利人"],
            date=r["最早优先权日"], direct=r["目标企业本身为申请人或当前权利人"].startswith("是"), links=[]))
        link = dict(person=r["自然人股东"], path=r["股权路径"], indirect=r["直接或间接"],
                    historic=r["是否历史股东"], start=r["股东起始日期"], end=r["退出日期"],
                    unit=r["交叉任职单位"], grade=r["核验级别"], before=r["申请早于股东起始日"])
        if link not in p["links"]:
            p["links"].append(link)
    for c in companies.values():
        c["patents"] = sorted(c["patents"].values(), key=lambda p: (p["date"], p["family"]), reverse=True)
    result = dict(date=f"{stamp[:4]}-{stamp[4:6]}-{stamp[6:]}",
                  source="股东穿透与历史任职_结果.xlsx",
                  patentSource="IncoPat筛选维度后_已回填企业类型及国家及技术标签.xlsx",
                  stats=json.loads(base.with_suffix(".json").read_text()), companies=list(companies.values()))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("window.SHAREHOLDER_LEADS = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    assert len(companies) == result["stats"]["source_companies"]
    assert sum(len(c["patents"]) > 0 for c in companies.values()) == result["stats"]["all_source_companies_with_hits"]
    print(json.dumps(dict(file=str(target), companies=len(companies), bytes=target.stat().st_size), ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default="20260916")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.date, args.output.resolve())
