#!/usr/bin/env python3
"""Generate the Atlas/enterprise browser payload from the unified family DB."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))

from backend import config  # noqa: E402
from backend.database import connect  # noqa: E402

DEFAULT_OUTPUT = ROOT / "output" / "site-payloads" / "dashboard-data.js"
DEFAULT_ENTERPRISE_DIRECTORY = ROOT.parent / "data" / "enterprise_directory.xlsx"

TYPES = ["私企", "国企", "高校", "研究所", "政府", "个人", "待核验"]
WORLD_MAP_NAMES = {
    "中国": "China", "美国": "United States", "日本": "Japan", "德国": "Germany",
    "俄罗斯": "Russia", "法国": "France", "英国": "United Kingdom", "韩国": "South Korea",
    "加拿大": "Canada", "意大利": "Italy", "瑞士": "Switzerland", "荷兰": "Netherlands",
    "奥地利": "Austria", "印度": "India", "乌克兰": "Ukraine", "以色列": "Israel",
    "澳大利亚": "Australia", "瑞典": "Sweden", "巴西": "Brazil", "西班牙": "Spain",
    "比利时": "Belgium", "芬兰": "Finland", "卢森堡": "Luxembourg", "罗马尼亚": "Romania",
    "捷克": "Czech Republic", "新加坡": "Singapore", "新西兰": "New Zealand", "波兰": "Poland",
    "匈牙利": "Hungary", "南非": "South Africa", "爱尔兰": "Ireland", "丹麦": "Denmark",
    "挪威": "Norway", "泰国": "Thailand", "伊朗": "Iran", "白俄罗斯": "Belarus",
    "土耳其": "Turkey", "智利": "Chile", "格鲁吉亚": "Georgia", "斯洛伐克": "Slovakia",
    "墨西哥": "Mexico", "哈萨克斯坦": "Kazakhstan", "阿根廷": "Argentina",
    "沙特阿拉伯": "Saudi Arabia", "爱沙尼亚": "Estonia", "越南": "Vietnam",
    "马来西亚": "Malaysia", "希腊": "Greece", "葡萄牙": "Portugal", "亚美尼亚": "Armenia",
    "克罗地亚": "Croatia", "斯洛文尼亚": "Slovenia", "埃及": "Egypt",
    "立陶宛": "Lithuania", "印度尼西亚": "Indonesia", "塞浦路斯": "Cyprus",
    "黎巴嫩": "Lebanon", "菲律宾": "Philippines", "摩纳哥": "Monaco", "伊拉克": "Iraq",
    "塞尔维亚": "Serbia", "阿尔巴尼亚": "Albania", "巴拿马": "Panama",
    "哥斯达黎加": "Costa Rica", "约旦": "Jordan", "乌兹别克斯坦": "Uzbekistan",
    "阿塞拜疆": "Azerbaijan", "拉脱维亚": "Latvia", "厄瓜多尔": "Ecuador",
    "古巴": "Cuba", "尼日尔": "Niger", "塞舌尔": "Seychelles", "委内瑞拉": "Venezuela",
}


def split_values(value: object) -> list[str]:
    return [part.strip() for part in re.split(r"[;；\r\n]+", str(value or "")) if part.strip()]


def normalize_enterprise_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = re.sub(r"[\s\[\]【】()（）·,，.。'\"“”‘’\-—_]", "", text)
    return re.sub(r"有限责任公司$", "有限公司", text)


def read_xlsx_rows(path: Path, sheet_name: str) -> list[list[str]]:
    """Read a modest XLSX sheet using only the standard library."""
    spreadsheet_ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    relationships_ns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    package_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = ["".join(node.itertext()) for node in shared_root.findall(f"{{{spreadsheet_ns}}}si")]

        workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {
            node.attrib["Id"]: node.attrib["Target"]
            for node in relationships_root.findall(f"{{{package_ns}}}Relationship")
        }
        worksheet_path = ""
        for node in workbook_root.findall(f".//{{{spreadsheet_ns}}}sheet"):
            if node.attrib.get("name") != sheet_name:
                continue
            target = targets[node.attrib[f"{{{relationships_ns}}}id"]].lstrip("/")
            worksheet_path = target if target.startswith("xl/") else f"xl/{target}"
            break
        if not worksheet_path:
            raise ValueError(f"Excel 中不存在工作表: {sheet_name}")

        worksheet_root = ET.fromstring(archive.read(worksheet_path))
        rows: list[list[str]] = []
        for row_node in worksheet_root.findall(f".//{{{spreadsheet_ns}}}row"):
            values: dict[int, str] = {}
            for cell in row_node.findall(f"{{{spreadsheet_ns}}}c"):
                reference = cell.attrib.get("r", "A1")
                letters = re.match(r"[A-Z]+", reference)
                column_index = 0
                for letter in letters.group(0) if letters else "A":
                    column_index = column_index * 26 + ord(letter) - 64
                cell_type = cell.attrib.get("t")
                if cell_type == "inlineStr":
                    value = "".join(cell.itertext())
                else:
                    value_node = cell.find(f"{{{spreadsheet_ns}}}v")
                    value = value_node.text if value_node is not None and value_node.text is not None else ""
                    if cell_type == "s" and value:
                        value = shared_strings[int(value)]
                values[column_index - 1] = value
            width = max(values, default=-1) + 1
            rows.append([values.get(index, "") for index in range(width)])
        return rows


def numeric_score(value: object) -> int | float | None:
    """Normalize IncoPat's 1–10 score fields for the browser payload."""
    try:
        score = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return int(score) if score.is_integer() else round(score, 2)


def normalize_region_name(value: object) -> str:
    """Remove presentation-only outer square brackets from region names."""
    text = str(value or "").strip()
    while len(text) >= 2 and (
        (text.startswith("[") and text.endswith("]"))
        or (text.startswith("【") and text.endswith("】"))
    ):
        inner = text[1:-1].strip()
        if not inner:
            break
        text = inner
    return text


def match_known_region(value: object, candidates: set[str]) -> str:
    """Map a free-form province/city string to an existing dashboard region."""
    text = normalize_region_name(value).replace(" ", "")
    if not text:
        return ""
    exact = text.removesuffix("省").removesuffix("市")
    if exact in candidates:
        return exact
    matches = [name for name in candidates if name and name in text]
    return max(matches, key=lambda name: (len(name), text.rfind(name))) if matches else ""


def cumulative_months(dates: list[str], year: int) -> list[int]:
    counts = [0] * 12
    for value in dates:
        match = re.match(rf"{year}-(\d{{1,2}})", value or "")
        if match:
            month = max(1, min(12, int(match.group(1))))
            counts[month - 1] += 1
    result, running = [], 0
    for count in counts:
        running += count
        result.append(running)
    return result


def empty_type_counts() -> dict[str, int]:
    return {name: 0 for name in TYPES}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--enterprise-directory", type=Path, default=DEFAULT_ENTERPRISE_DIRECTORY)
    args = parser.parse_args()

    connection = connect()
    metadata = dict(connection.execute("SELECT `key`, `value` FROM metadata"))

    families: dict[str, dict] = {}
    query = '''
        SELECT family_id,priority_year,`最早优先权日` AS date,
               `家族代表公开（公告）号` AS publication,
               `标题 (中文)` AS title_cn,`标题 (英文)` AS title_en,
               `IPC主分类-小类` AS ipc_subclass,
               `家族引证` AS cites,`家族被引证` AS cited_by,
               `合享价值度` AS value_score,`技术稳定性` AS stability_score,
               `技术先进性` AS advanced_score,`保护范围` AS scope_score,
               technical_feature,technology_code,technology_label,
               route_code,route_label,chain_level1,chain_level2,chain_level3
        FROM v_family_complete ORDER BY source_patent_id
    '''
    for row in connection.execute(query):
        family_id = row["family_id"]
        families[family_id] = {
            "id": family_id,
            "publication": row["publication"] or family_id,
            "year": row["priority_year"],
            "date": row["date"] or "",
            "title": row["title_cn"] or row["title_en"] or "",
            "ipc_subclass": str(row["ipc_subclass"] or "").strip(),
            "is_core": str(row["ipc_subclass"] or "").strip() == "G21B",
            "sao": row["technical_feature"] or "",
            "tech_code": row["technology_code"],
            "tech": f'[{row["technology_code"]}] {row["technology_label"]}',
            "route_code": row["route_code"],
            "route": row["route_label"],
            "chain1": row["chain_level1"],
            "chain2": row["chain_level2"],
            "chain3": row["chain_level3"],
            "cites": len(split_values(row["cites"])),
            "citedBy": len(split_values(row["cited_by"])),
            "valueScore": numeric_score(row["value_score"]),
            "stabilityScore": numeric_score(row["stability_score"]),
            "advancedScore": numeric_score(row["advanced_score"]),
            "scopeScore": numeric_score(row["scope_score"]),
        }

    valid_years = [item["year"] for item in families.values() if isinstance(item["year"], int)]
    core_family_ids = {family_id for family_id, item in families.items() if item["is_core"]}
    year_min, year_max = min(valid_years), max(valid_years)
    years = list(range(year_min, year_max + 1))
    year_index = {year: index for index, year in enumerate(years)}

    family_types: dict[str, set[str]] = defaultdict(set)
    family_entities: dict[str, list[dict]] = defaultdict(list)
    entity_families: dict[int, set[str]] = defaultdict(set)
    entity_aliases: dict[int, set[str]] = defaultdict(set)
    for row in connection.execute(
        "SELECT family_id,entity_id,entity_name,enterprise_type,entity_source "
        "FROM family_entities ORDER BY family_id,entity_order"
    ):
        enterprise_type = row["enterprise_type"] if row["enterprise_type"] in TYPES else "待核验"
        family_types[row["family_id"]].add(enterprise_type)
        family_entities[row["family_id"]].append({
            "entity_id": row["entity_id"], "name": row["entity_name"], "type": enterprise_type,
        })
        if row["entity_source"] == "当前权利人" and row["entity_id"] is not None:
            entity_families[row["entity_id"]].add(row["family_id"])
            owner_name = str(row["entity_name"] or "").strip()
            if owner_name and owner_name != "主体未识别":
                entity_aliases[row["entity_id"]].add(owner_name)

    # Retain standardized owner names as searchable aliases.  The unified DB
    # groups entities by these names, but representative_name intentionally
    # remains a frequently occurring raw owner name for display.
    for row in connection.execute(
        'SELECT fe.entity_id,fe.entity_order,f.`当前权利人` AS raw_owners,'
        'f.`标准化当前权利人` AS standardized_owners '
        'FROM family_entities fe JOIN families f USING(family_id) '
        "WHERE fe.entity_source='当前权利人' AND fe.entity_id IS NOT NULL"
    ):
        raw_names = split_values(row["raw_owners"])
        standardized_names = split_values(row["standardized_owners"])
        alias_index = row["entity_order"] - 1
        if len(raw_names) != len(standardized_names) or alias_index >= len(standardized_names):
            continue
        standardized_name = standardized_names[alias_index]
        if standardized_name and standardized_name != "主体未识别":
            entity_aliases[row["entity_id"]].add(standardized_name)

    family_geos: dict[str, list[dict]] = defaultdict(list)
    for row in connection.execute(
        "SELECT family_id,country,province,city,district FROM family_applicant_geographies "
        "ORDER BY family_id,geo_order"
    ):
        family_geos[row["family_id"]].append({
            "family_id": row["family_id"],
            "country": str(row["country"] or "").strip(),
            "province": normalize_region_name(row["province"]),
            "city": normalize_region_name(row["city"]),
            "district": normalize_region_name(row["district"]),
        })

    country_families: dict[str, set[str]] = defaultdict(set)
    country_type_families: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    province_families: dict[str, set[str]] = defaultdict(set)
    province_type_families: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    city_families: dict[str, set[str]] = defaultdict(set)
    province_cities: dict[str, set[str]] = defaultdict(set)
    for family_id, geos in family_geos.items():
        for geo in geos:
            country = geo["country"] or "国家未识别"
            country_families[country].add(family_id)
            for enterprise_type in family_types.get(family_id, {"待核验"}):
                country_type_families[country][enterprise_type].add(family_id)
            if country == "中国" and geo["province"]:
                province = geo["province"]
                province_families[province].add(family_id)
                for enterprise_type in family_types.get(family_id, {"待核验"}):
                    province_type_families[province][enterprise_type].add(family_id)
                if geo["city"]:
                    city_families[geo["city"]].add(family_id)
                    province_cities[province].add(geo["city"])

    def trend_for(ids: set[str]) -> list[int]:
        result = [0] * len(years)
        for family_id in ids:
            year = families[family_id]["year"]
            if year in year_index:
                result[year_index[year]] += 1
        return result

    def monthly_for(ids: set[str]) -> dict[str, list[int]]:
        return {
            str(year): cumulative_months([families[item]["date"] for item in ids], year)
            for year in range(max(year_min, year_max - 2), year_max + 1)
        }

    world_countries = []
    for country, ids in sorted(country_families.items(), key=lambda item: (-len(item[1]), item[0])):
        type_counts = empty_type_counts()
        for enterprise_type in TYPES:
            type_counts[enterprise_type] = len(country_type_families[country][enterprise_type])
        world_countries.append({
            "name": country, "mapName": WORLD_MAP_NAMES.get(country), "value": len(ids), "types": type_counts,
        })
    world_types = empty_type_counts()
    for enterprise_type in TYPES:
        world_types[enterprise_type] = len({fid for fid, values in family_types.items() if enterprise_type in values})
    world_trends = [
        {"name": country, "values": trend_for(ids), "monthly": monthly_for(ids)}
        for country, ids in sorted(country_families.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    # The regional ranking deliberately uses the raw current-owner names rather
    # than standardized/representative entity names. Exact raw names are merged;
    # different spellings remain separate as requested.
    owner_families: dict[str, set[str]] = defaultdict(set)
    owner_type_families: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for row in connection.execute(
        "SELECT family_id,entity_name,enterprise_type FROM family_entities "
        "WHERE entity_source='当前权利人' ORDER BY family_id,entity_order"
    ):
        enterprise_type = row["enterprise_type"] if row["enterprise_type"] in TYPES else "待核验"
        owner_name = str(row["entity_name"] or "").strip()
        if not owner_name or owner_name == "主体未识别":
            continue
        owner_families[owner_name].add(row["family_id"])
        owner_type_families[owner_name][enterprise_type].add(row["family_id"])

    def owner_primary_type(owner_name: str) -> str:
        candidates = []
        for enterprise_type in TYPES:
            ids = owner_type_families[owner_name][enterprise_type]
            count = len(ids)
            candidates.append((count, -TYPES.index(enterprise_type), enterprise_type))
        return max(candidates)[2] if candidates and max(candidates)[0] else "待核验"

    def organization_record(owner_name: str) -> dict:
        ids = owner_families[owner_name]
        return {
            "name": owner_name, "value": len(ids),
            "relevantValue": len(ids & core_family_ids),
            "type": owner_primary_type(owner_name),
            "trend": trend_for(ids), "monthly": monthly_for(ids),
        }

    known_provinces = set(province_families)
    known_cities = set(city_families)
    china_owner_names: set[str] = set()
    province_owner_names: dict[str, set[str]] = defaultdict(set)
    city_owner_names: dict[str, set[str]] = defaultdict(set)
    for row in connection.execute(
        "SELECT owner_name,country,province,city FROM owner_name_locations "
        "WHERE owner_name IS NOT NULL AND TRIM(owner_name)<>''"
    ):
        owner_name = str(row["owner_name"]).strip()
        if owner_name not in owner_families or row["country"] != "中国":
            continue
        china_owner_names.add(owner_name)
        province = match_known_region(row["province"], known_provinces)
        city = match_known_region(row["city"], known_cities)
        if province:
            province_owner_names[province].add(owner_name)
        if city:
            city_owner_names[city].add(owner_name)

    china_ids = country_families.get("中国", set())
    china_organizations = sorted(
        (organization_record(owner_name) for owner_name in china_owner_names),
        key=lambda item: (-item["relevantValue"], -item["value"], item["name"]),
    )

    def organizations_for(names: set[str], limit: int = 80) -> list[dict]:
        records = [organization_record(owner_name) for owner_name in names]
        return sorted(
            records,
            key=lambda item: (-item["relevantValue"], -item["value"], item["name"]),
        )[:limit]

    china_provinces = []
    for province, ids in sorted(province_families.items(), key=lambda item: (-len(item[1]), item[0])):
        type_counts = empty_type_counts()
        for enterprise_type in TYPES:
            type_counts[enterprise_type] = len(province_type_families[province][enterprise_type])
        china_provinces.append({
            "name": province, "value": len(ids),
            "relevantValue": len(ids & core_family_ids), "types": type_counts,
            "trend": trend_for(ids), "monthly": monthly_for(ids),
            "organizations": organizations_for(province_owner_names.get(province, set())),
            "cities": sorted(province_cities.get(province, set())),
        })
    china_cities = []
    for city, ids in sorted(city_families.items(), key=lambda item: (-len(item[1]), item[0])):
        china_cities.append({
            "name": city, "value": len(ids),
            "relevantValue": len(ids & core_family_ids),
            "trend": trend_for(ids), "monthly": monthly_for(ids),
            "organizations": organizations_for(city_owner_names.get(city, set())),
        })
    china_cities.sort(key=lambda item: (-item["relevantValue"], -item["value"], item["name"]))

    def patent_record(family_id: str, fraction: float = 1.0) -> dict:
        family = families[family_id]
        return {
            "id": family["publication"], "familyId": family_id, "date": family["date"],
            "year": family["year"], "title": family["title"], "sao": family["sao"],
            "tech": family["tech"], "chain1": family["chain1"], "chain2": family["chain2"],
            "chain3": family["chain3"], "cites": family["cites"], "citedBy": family["citedBy"],
            "valueScore": family["valueScore"], "stabilityScore": family["stabilityScore"],
            "advancedScore": family["advancedScore"], "scopeScore": family["scopeScore"],
            "ipcSubclass": family["ipc_subclass"], "core": family["is_core"],
            "fraction": round(fraction, 8),
        }

    organization_patents = {}
    for record in china_organizations:
        # Exact duplicate raw current-owner names are intentionally merged.
        ids = owner_families[record["name"]]
        organization_patents[record["name"]] = [
            patent_record(fid) for fid in sorted(ids, key=lambda fid: (families[fid]["date"], fid), reverse=True)
        ]

    benchmark_patents = []
    for family_id, family in families.items():
        geos = family_geos.get(family_id, [])
        benchmark_patents.append({
            "id": family_id, "publication": family["publication"], "year": family["year"],
            "ipcSubclass": family["ipc_subclass"], "core": family["is_core"],
            "countries": sorted({item["country"] for item in geos if item["country"]}),
            "provinces": sorted({item["province"] for item in geos if item["country"] == "中国" and item["province"]}),
            "tech": [family["tech"]], "route": [family["route"]],
            "chain1": [family["chain1"]], "chain2": [family["chain2"]], "chain3": [family["chain3"]],
        })

    recent_start = year_max - 4

    def profile_from_family_ids(
        *, name: str, aliases: list[str], enterprise_type: str,
        countries: list[str], provinces: list[str], cities: list[str],
        family_ids: set[str], profile_scope: str, profile_source: str,
    ) -> dict:
        patent_ids = sorted(family_ids, key=lambda fid: (families[fid]["date"], fid), reverse=True)
        chain = Counter(families[fid]["chain1"] or "缺失" for fid in family_ids)
        for label in ("上游", "中游", "下游", "不适用", "缺失"):
            chain.setdefault(label, 0)
        valid = chain["上游"] + chain["中游"] + chain["下游"]
        ratios = {label: (chain[label] / valid if valid else 0) for label in ("上游", "中游", "下游")}
        positioning = (max(ratios, key=ratios.get) + "企业") if valid else "定位未明确"
        return {
            "name": name, "type": enterprise_type, "aliases": sorted(set(aliases) - {name}),
            "countries": sorted(set(countries)), "provinces": sorted(set(provinces)), "cities": sorted(set(cities)),
            "value": len(family_ids), "fractionalValue": len(family_ids),
            "recent5": sum(1 for fid in family_ids if families[fid]["year"] and families[fid]["year"] >= recent_start),
            "firstYear": min((families[fid]["year"] for fid in family_ids if families[fid]["year"]), default=None),
            "chain": dict(chain), "ratios": ratios, "positioning": positioning,
            "profileScope": profile_scope, "profileSource": profile_source,
            "patents": [patent_record(fid) for fid in patent_ids],
        }

    # Current-owner enterprise profiles.
    entity_info = {
        row["entity_id"]: dict(row)
        for row in connection.execute(
            "SELECT e.entity_id,e.representative_name,e.enterprise_type,l.country,l.province,l.city "
            "FROM entities e JOIN entity_locations l USING(entity_id)"
        )
    }
    entity_owner_locations: dict[int, dict[str, set[str]]] = defaultdict(
        lambda: {"countries": set(), "provinces": set(), "cities": set()}
    )
    for row in connection.execute(
        "SELECT entity_id,country,province,city FROM owner_name_locations "
        "WHERE entity_id IS NOT NULL"
    ):
        locations = entity_owner_locations[row["entity_id"]]
        if row["country"]:
            locations["countries"].add(row["country"])
        if row["country"] == "中国" and row["province"]:
            locations["provinces"].add(row["province"])
        if row["country"] == "中国" and row["city"]:
            locations["cities"].add(row["city"])
    companies = []
    profiled_entity_ids: set[int] = set()
    for entity_id, ids in entity_families.items():
        info = entity_info.get(entity_id)
        if not info or info["enterprise_type"] == "个人":
            continue
        profiled_entity_ids.add(entity_id)
        patent_ids = sorted(ids, key=lambda fid: (families[fid]["date"], fid), reverse=True)
        chain = Counter(families[fid]["chain1"] or "缺失" for fid in ids)
        for label in ("上游", "中游", "下游", "不适用", "缺失"):
            chain.setdefault(label, 0)
        valid = chain["上游"] + chain["中游"] + chain["下游"]
        ratios = {label: (chain[label] / valid if valid else 0) for label in ("上游", "中游", "下游")}
        positioning = (max(ratios, key=ratios.get) + "企业") if valid else "定位未明确"
        owner_locations = entity_owner_locations.get(entity_id, {})
        countries = sorted(set(owner_locations.get("countries", set())) | ({info["country"]} if info["country"] else set()))
        provinces = sorted(set(owner_locations.get("provinces", set())) | ({info["province"]} if info["country"] == "中国" and info["province"] else set()))
        cities = sorted(set(owner_locations.get("cities", set())) | ({info["city"]} if info["country"] == "中国" and info["city"] else set()))
        aliases = sorted(entity_aliases.get(entity_id, set()) - {info["representative_name"]})
        companies.append({
            "name": info["representative_name"], "type": info["enterprise_type"],
            "aliases": aliases,
            "countries": countries, "provinces": provinces, "cities": cities,
            "value": len(ids), "fractionalValue": len(ids),
            "recent5": sum(1 for fid in ids if families[fid]["year"] and families[fid]["year"] >= recent_start),
            "firstYear": min((families[fid]["year"] for fid in ids if families[fid]["year"]), default=None),
            "chain": dict(chain), "ratios": ratios, "positioning": positioning,
            "profileScope": "当前权利人", "profileSource": "family_entities.entity_source=当前权利人",
            "patents": [patent_record(fid) for fid in patent_ids],
        })
    companies.sort(key=lambda item: (-item["value"], item["name"]))

    # Applicant and ultimate-parent profiles are directory-only fallbacks. They
    # never enter current-owner rankings, maps, metrics or industry-chain flows.
    applicant_families: dict[str, set[str]] = defaultdict(set)
    parent_families: dict[str, set[str]] = defaultdict(set)
    for row in connection.execute('''
        SELECT family_id,`申请人` AS applicant_raw,`标准化申请人` AS applicant_standardized,
               `申请人终属母公司(中文)` AS parent_cn,`申请人终属母公司(英文)` AS parent_en
        FROM families
    '''):
        for name in split_values(row["applicant_raw"]) + split_values(row["applicant_standardized"]):
            applicant_families[normalize_enterprise_name(name)].add(row["family_id"])
        for name in split_values(row["parent_cn"]) + split_values(row["parent_en"]):
            parent_families[normalize_enterprise_name(name)].add(row["family_id"])

    fallback_groups: dict[str, dict] = {}
    if args.enterprise_directory.is_file():
        directory_rows = read_xlsx_rows(args.enterprise_directory, "企业总名单")
        headers = [str(value or "").strip() for value in directory_rows[0]]
        column = {header: index for index, header in enumerate(headers)}
        required = ["企业中文名称", "国家/地区", "省份", "城市", "数据来源", "IncoPat主体口径"]
        missing = [field for field in required if field not in column]
        if missing:
            raise ValueError(f"企业名单缺少申请人回退构建字段: {missing}")
        for row in directory_rows[1:]:
            row = row + [""] * (len(headers) - len(row))
            name = str(row[column["企业中文名称"]] or "").strip()
            scope = str(row[column["IncoPat主体口径"]] or "").strip()
            if not name or scope.startswith("当前权利人-"):
                continue
            normalized_name = normalize_enterprise_name(name)
            if scope.startswith("申请人-"):
                profile_scope = "申请人"
                ids = applicant_families.get(normalized_name, set())
            elif scope.startswith("申请人终属母公司-"):
                profile_scope = "申请人终属母公司"
                ids = parent_families.get(normalized_name, set())
            else:
                ids = applicant_families.get(normalized_name, set())
                profile_scope = "申请人"
                if not ids:
                    ids = parent_families.get(normalized_name, set())
                    profile_scope = "申请人终属母公司"
            if not ids:
                continue
            key = normalized_name
            group = fallback_groups.setdefault(key, {
                "name": name, "aliases": set(), "ids": set(), "scope": profile_scope,
                "source": str(row[column["数据来源"]] or "").strip(),
                "countries": set(), "provinces": set(), "cities": set(),
            })
            group["aliases"].add(name)
            group["ids"].update(ids)
            country = str(row[column["国家/地区"]] or "").strip() or "中国"
            province = str(row[column["省份"]] or "").strip()
            city = str(row[column["城市"]] or "").strip()
            group["countries"].add(country)
            if province:
                group["provinces"].add(province)
            if city:
                group["cities"].add(city)

    directory_fallback_companies = [
        profile_from_family_ids(
            name=group["name"], aliases=sorted(group["aliases"]), enterprise_type="企业",
            countries=sorted(group["countries"]), provinces=sorted(group["provinces"]), cities=sorted(group["cities"]),
            family_ids=group["ids"], profile_scope=group["scope"], profile_source=group["source"],
        )
        for group in fallback_groups.values()
    ]
    directory_fallback_companies.sort(key=lambda item: (-item["value"], item["name"]))

    china_types = empty_type_counts()
    for enterprise_type in TYPES:
        china_types[enterprise_type] = len({fid for fid in china_ids if enterprise_type in family_types.get(fid, set())})
    payload = {
        "meta": {
            "source": Path(metadata.get("source_xlsx", config.MYSQL["database"])).name,
            "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "rows": len(families), "families": len(families), "yearMin": year_min, "yearMax": year_max,
            "countryCount": len(world_countries), "provinceCount": len(china_provinces), "cityCount": len(china_cities),
            "unknownCountry": len(country_families.get("国家未识别", set())), "formalChineseNameColumn": True,
            "deduplicationKey": "家族ID", "countingMethod": "simple_family_distinct",
            "regionalOrganizationScope": "raw_current_owner_location",
            "corePatentDefinition": "IPC主分类-小类=G21B",
            "corePatentCount": len(core_family_ids),
            "dataCutoff": max((item["date"] for item in families.values()), default=""),
            "relevantPatentCount": len(families), "benchmarkRelevantPatentCount": len(benchmark_patents),
            "familyScope": metadata.get("family_scope", "简单专利族"),
            "dataSource": metadata.get("data_source", "IncoPat"),
        },
        "types": TYPES,
        "world": {"total": len(families), "types": world_types, "countries": world_countries, "years": years, "trends": world_trends},
        "china": {
            "total": len(china_ids), "types": china_types, "years": years, "trend": trend_for(china_ids),
            "comparisonYears": list(range(max(year_min, year_max - 2), year_max + 1)),
            "monthly": monthly_for(china_ids), "organizationPatents": organization_patents,
            "organizations": china_organizations, "provinces": china_provinces, "cities": china_cities,
        },
        "enterprise": {
            "method": {
                "scope": "current_owner_entities_all_time", "combinationCounting": "one_per_entity_family",
                "fractionalCounting": "not_applied", "citationEdgesAvailable": True,
                "spcAvailable": False, "spnpAvailable": False,
            },
            "metrics": {
                "enterpriseCount": len(companies),
                "relatedFamilyCount": len({fid for entity_id in profiled_entity_ids for fid in entity_families[entity_id]}),
                "combinationCount": sum(item["value"] for item in companies),
                "fractionalCount": len({fid for ids in entity_families.values() for fid in ids}),
                "privateCount": sum(item["type"] == "私企" for item in companies),
                "stateCount": sum(item["type"] == "国企" for item in companies),
                "mixedCount": 0,
                "crossChainCount": sum(sum(item["chain"][label] > 0 for label in ("上游", "中游", "下游")) > 1 for item in companies),
                "mainPathCount": None,
                "newCompany5YearCount": sum((item["firstYear"] or 0) >= recent_start for item in companies),
                "formalNameCoverage": 1, "formalNameCovered": len(companies), "formalNameBase": len(companies),
            },
            "companies": companies,
            "directoryFallbackCompanies": directory_fallback_companies,
        },
        "benchmark": {
            "scope": "all_B0_B9_simple_families", "deduplicationKey": "家族ID",
            "countingMethod": "simple_family_distinct", "patents": benchmark_patents,
        },
    }
    connection.close()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(args.output.suffix + ".building")
    temp.write_text(
        "window.DASHBOARD_DATA=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    temp.replace(args.output)
    print(json.dumps({
        "output": str(args.output), "families": len(families), "companies": len(companies),
        "directoryFallbackCompanies": len(directory_fallback_companies),
        "countries": len(world_countries), "provinces": len(china_provinces), "cities": len(china_cities),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
