from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "output" / "统一专利族数据.sqlite3"
OUTPUT = BASE_DIR.parent / "未来产业洞见系统demo" / "assets" / "derwent" / "data" / "dashboard-data.js"

TECHNOLOGY_ORDER = [f"B{index}" for index in range(10)]
TECHNOLOGY_LABELS = {
    "B0": "[B0] 无直接聚变应用映射",
    "B1": "[B1] 磁约束聚变 MCF",
    "B2": "[B2] FRC 与紧凑环聚变",
    "B3": "[B3] 磁惯性聚变 MIF",
    "B4": "[B4] 惯性约束聚变 ICF",
    "B5": "[B5] 替代、非热及其他聚变路线",
    "B6": "[B6] LENR 与凝聚态低能核反应",
    "B7": "[B7] 通用聚变支撑技术",
    "B8": "[B8] 聚变基础科学",
    "B9": "[B9] 潜力应用",
}
INDUSTRY_ORDER = ["上游", "中游", "下游", "不适用"]


def normalize_patent(value: object) -> str:
    patent = re.sub(r"\s+", "", str(value or "").strip()).upper()
    if patent and "-" not in patent:
        match = re.match(r"^(.+\d)([A-Z]\d{0,2})$", patent)
        if match:
            patent = f"{match.group(1)}-{match.group(2)}"
    return patent


def publication_base(patent: str) -> str:
    return normalize_patent(patent).split("-", 1)[0]


def split_values(value: object) -> list[str]:
    return [item.strip() for item in re.split(r"[;；\r\n]+", str(value or "")) if item.strip()]


def parse_date(value: object, fallback_year: int | None = None) -> date | None:
    text = str(value or "").strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            pass
    return date(int(fallback_year), 1, 1) if fallback_year else None


def aggregate(connection: sqlite3.Connection, table: str, column: str) -> dict[str, str]:
    query = f"""
        SELECT family_id, group_concat(value, '；')
        FROM (
            SELECT family_id, trim({column}) value
            FROM {table}
            WHERE trim(coalesce({column}, '')) <> ''
            GROUP BY family_id, trim({column})
            ORDER BY family_id
        ) GROUP BY family_id
    """
    return {str(row[0]): str(row[1] or "") for row in connection.execute(query)}


def aggregate_owner_types(connection: sqlite3.Connection) -> dict[str, str]:
    """Aggregate current-owner types without treating absent owners as unreviewed entities."""
    query = """
        SELECT family_id, group_concat(value, '；')
        FROM (
            SELECT family_id,
                   CASE
                     WHEN entity_name = '主体未识别' THEN '主体信息缺失'
                     ELSE trim(enterprise_type)
                   END value
            FROM family_entities
            WHERE trim(coalesce(enterprise_type, '')) <> ''
            GROUP BY family_id, value
            ORDER BY family_id
        ) GROUP BY family_id
    """
    return {str(row[0]): str(row[1] or "") for row in connection.execute(query)}


def best_route_candidates(
    nodes: set[str],
    edges: list[tuple[str, str]],
    edge_scores: dict[tuple[str, str], int],
    order_key: dict[str, tuple],
    limit: int,
    max_overlap: float | None = None,
) -> list[tuple[int, list[tuple[str, str]]]]:
    successors: dict[str, list[str]] = defaultdict(list)
    predecessors: dict[str, list[str]] = defaultdict(list)
    for source, target in edges:
        successors[source].append(target)
        predecessors[target].append(source)
    ordered = sorted(nodes, key=order_key.__getitem__)
    prefix_score: dict[str, int] = {node: 0 for node in nodes}
    prefix_prev: dict[str, str | None] = {node: None for node in nodes}
    for target in ordered:
        for source in predecessors.get(target, ()):
            score = prefix_score[source] + edge_scores.get((source, target), 0)
            if score > prefix_score[target]:
                prefix_score[target] = score
                prefix_prev[target] = source
    suffix_score: dict[str, int] = {node: 0 for node in nodes}
    suffix_next: dict[str, str | None] = {node: None for node in nodes}
    for source in reversed(ordered):
        for target in successors.get(source, ()):
            score = edge_scores.get((source, target), 0) + suffix_score[target]
            if score > suffix_score[source]:
                suffix_score[source] = score
                suffix_next[source] = target

    def reconstruct(source: str, target: str) -> list[tuple[str, str]]:
        prefix_nodes = [source]
        cursor = source
        seen = {cursor}
        while prefix_prev.get(cursor) is not None and prefix_prev[cursor] not in seen:
            cursor = prefix_prev[cursor]  # type: ignore[assignment]
            prefix_nodes.append(cursor)
            seen.add(cursor)
        prefix_nodes.reverse()
        path = list(zip(prefix_nodes, prefix_nodes[1:]))
        path.append((source, target))
        cursor = target
        seen = {cursor}
        while suffix_next.get(cursor) is not None and suffix_next[cursor] not in seen:
            next_node = suffix_next[cursor]
            path.append((cursor, next_node))  # type: ignore[arg-type]
            cursor = next_node  # type: ignore[assignment]
            seen.add(cursor)
        return path

    ranked_edges = sorted(
        edges,
        key=lambda edge: -(
            prefix_score[edge[0]] + edge_scores.get(edge, 0) + suffix_score[edge[1]]
        ),
    )
    unique: dict[tuple[tuple[str, str], ...], int] = {}
    for source, target in ranked_edges[: min(len(ranked_edges), 10000)]:
        path = reconstruct(source, target)
        key = tuple(path)
        score = sum(edge_scores.get(edge, 0) for edge in path)
        unique[key] = max(score, unique.get(key, 0))
    candidates = sorted(unique.items(), key=lambda item: (-item[1], -len(item[0]), item[0]))
    selected: list[tuple[int, list[tuple[str, str]]]] = []
    for path_tuple, score in candidates:
        path_set = set(path_tuple)
        if max_overlap is not None and any(
            len(path_set & set(existing)) / max(1, len(path_set | set(existing))) > max_overlap
            for _, existing in selected
        ):
            continue
        selected.append((score, list(path_tuple)))
        if len(selected) >= limit:
            break
    return selected


def spnp_scores(
    allowed_nodes: set[str],
    edges: list[tuple[str, str]],
    order_key: dict[str, tuple],
) -> dict[tuple[str, str], int]:
    local_edges = [edge for edge in edges if edge[0] in allowed_nodes and edge[1] in allowed_nodes]
    predecessors: dict[str, list[str]] = defaultdict(list)
    successors: dict[str, list[str]] = defaultdict(list)
    for source, target in local_edges:
        successors[source].append(target)
        predecessors[target].append(source)
    ordered = sorted(allowed_nodes, key=order_key.__getitem__)
    index = {node: position for position, node in enumerate(ordered)}
    upstream: dict[str, int] = {}
    for node in ordered:
        bits = 1 << index[node]
        for predecessor in predecessors.get(node, ()):
            bits |= upstream[predecessor]
        upstream[node] = bits
    downstream: dict[str, int] = {}
    for node in reversed(ordered):
        bits = 1 << index[node]
        for successor in successors.get(node, ()):
            bits |= downstream[successor]
        downstream[node] = bits
    return {
        edge: upstream[edge[0]].bit_count() * downstream[edge[1]].bit_count()
        for edge in local_edges
    }


def path_rows(
    ranked: list[tuple[int, list[tuple[str, str]]]],
    score_label: str,
    labels: dict[str, str],
    source_group: str = "",
) -> list[dict]:
    rows = []
    for rank, (score, path) in enumerate(ranked, 1):
        nodes = [path[0][0], *(target for _, target in path)]
        rows.append({
            "rank": rank,
            "score": score,
            "scoreLabel": score_label,
            "sourceGroup": source_group,
            "length": len(path),
            "edges": [[source, target] for source, target in path],
            "nodes": nodes,
            "start": nodes[0],
            "end": nodes[-1],
            "startLabel": labels.get(nodes[0], nodes[0]),
            "endLabel": labels.get(nodes[-1], nodes[-1]),
            "overlapEdges": 0,
            "overlapNodes": 0,
            "edgeOverlapRate": 0,
            "nodeOverlapRate": 0,
        })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    database = args.database.resolve()
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    metadata = dict(connection.execute("SELECT key,value FROM metadata"))
    applicant_names = aggregate(connection, "family_applicants", "applicant_name")
    # Enterprise type follows the confirmed current-owner entity convention.
    # Geography and displayed applicant names remain applicant-based.
    owner_types = aggregate_owner_types(connection)
    applicant_countries = aggregate(connection, "family_applicant_geographies", "country")
    applicant_provinces = aggregate(connection, "family_applicant_geographies", "province")
    applicant_cities = aggregate(connection, "family_applicant_geographies", "city")
    query = """
        SELECT f.*, t.technical_feature, t.technology_code, t.technology_label,
               t.chain_level1, t.chain_level2, t.chain_level3
        FROM families f JOIN family_tech t ON t.family_id=f.family_id
        ORDER BY f.family_id
    """
    records = list(connection.execute(query))
    family_to_node: dict[str, str] = {}
    patent_to_family: dict[str, str] = {}
    family_members: dict[str, list[str]] = {}
    raw_citations: dict[str, list[str]] = {}
    record_by_family = {str(row["family_id"]): row for row in records}
    duplicate_node_ids: Counter[str] = Counter()
    for row in records:
        family_id = str(row["family_id"])
        representative = normalize_patent(row["家族代表公开（公告）号"])
        members = []
        for value in split_values(row["简单同族"]):
            patent = normalize_patent(value)
            if patent and patent not in members:
                members.append(patent)
        if representative and representative not in members:
            members.insert(0, representative)
        if not members:
            members = [f"FAMILY-{family_id}"]
        node_id = representative or members[0]
        duplicate_node_ids[node_id] += 1
        if duplicate_node_ids[node_id] > 1:
            node_id = f"{node_id}#{family_id}"
        family_to_node[family_id] = node_id
        family_members[family_id] = members
        for patent in members:
            patent_to_family.setdefault(patent, family_id)
            patent_to_family.setdefault(publication_base(patent), family_id)
        raw_citations[family_id] = [normalize_patent(value) for value in split_values(row["家族引证"])]

    dates: dict[str, date | None] = {}
    order_key: dict[str, tuple] = {}
    for family_id, node_id in family_to_node.items():
        row = record_by_family[family_id]
        node_date = parse_date(row["最早优先权日"], row["priority_year"])
        dates[node_id] = node_date
        order_key[node_id] = (node_date or date(9999, 12, 31), node_id)

    edge_counts: Counter[tuple[str, str]] = Counter()
    raw_cp = 0
    external_cp: set[str] = set()
    time_reversed = 0
    same_time_order_removed = 0
    for citing_family, citations in raw_citations.items():
        target = family_to_node[citing_family]
        cited_families: set[str] = set()
        raw_cp += len(citations)
        for citation in citations:
            cited_family = patent_to_family.get(citation) or patent_to_family.get(publication_base(citation))
            if not cited_family:
                external_cp.add(citation)
                continue
            if cited_family == citing_family or cited_family in cited_families:
                continue
            cited_families.add(cited_family)
            source = family_to_node[cited_family]
            source_date, target_date = dates[source], dates[target]
            if source_date and target_date and source_date > target_date:
                time_reversed += 1
                continue
            if order_key[source] >= order_key[target]:
                same_time_order_removed += 1
                continue
            edge_counts[(source, target)] += 1

    all_nodes = set(family_to_node.values())
    family_by_node = {node: family for family, node in family_to_node.items()}
    network_nodes = {
        node_id
        for node_id, family_id in family_by_node.items()
        if str(record_by_family[family_id]["technology_code"] or "") in {
            f"B{index}" for index in range(1, 10)
        }
        and split_values(record_by_family[family_id]["chain_level2"])
    }
    graph_edges = [
        edge for edge in edge_counts
        if edge[0] in network_nodes and edge[1] in network_nodes
    ]
    successors: dict[str, list[str]] = defaultdict(list)
    predecessors: dict[str, list[str]] = defaultdict(list)
    for source, target in graph_edges:
        successors[source].append(target)
        predecessors[target].append(source)
    ordered = sorted(all_nodes, key=order_key.__getitem__)
    network_ordered = sorted(network_nodes, key=order_key.__getitem__)
    path_from: dict[str, int] = {}
    for node in network_ordered:
        path_from[node] = sum(path_from[pred] for pred in predecessors.get(node, ())) or 1
    path_to: dict[str, int] = {}
    for node in reversed(network_ordered):
        path_to[node] = sum(path_to[succ] for succ in successors.get(node, ())) or 1
    edge_spc = {edge: path_from[edge[0]] * path_to[edge[1]] for edge in graph_edges}
    top_spc = best_route_candidates(network_nodes, graph_edges, edge_spc, order_key, 10)
    top_diverse = best_route_candidates(network_nodes, graph_edges, edge_spc, order_key, 10, .5)

    node_labels = {node: node for node in all_nodes}
    in_spc: Counter[str] = Counter()
    out_spc: Counter[str] = Counter()
    for (source, target), score in edge_spc.items():
        out_spc[source] += score
        in_spc[target] += score

    tech_nodes: dict[str, set[str]] = defaultdict(set)
    for family_id, node_id in family_to_node.items():
        tech_nodes[str(record_by_family[family_id]["technology_code"] or "")].add(node_id)
    level2_classified_nodes = {
        node_id
        for node_id, family_id in family_by_node.items()
        if split_values(record_by_family[family_id]["chain_level2"])
    }
    bx_b7_paths: dict[str, list[dict]] = {}
    bx_b7_meta: dict[str, dict[str, int]] = {}
    b7_nodes = tech_nodes.get("B7", set()) & level2_classified_nodes
    edge_set = set(graph_edges)
    for code in (f"B{index}" for index in range(1, 7)):
        bx_nodes = tech_nodes.get(code, set()) & level2_classified_nodes
        connected_b7 = {
            target for source, target in edge_set if source in bx_nodes and target in b7_nodes
        } | {
            source for source, target in edge_set if source in b7_nodes and target in bx_nodes
        }
        allowed = set(bx_nodes) | connected_b7
        local_edges = [edge for edge in graph_edges if edge[0] in allowed and edge[1] in allowed]
        scores = spnp_scores(allowed, local_edges, order_key) if local_edges else {}
        ranked = best_route_candidates(allowed, local_edges, scores, order_key, 3) if local_edges else []
        bx_b7_paths[code] = path_rows(ranked, "SPNP", node_labels, f"{code}∪关联B7")
        bx_b7_meta[code] = {
            "bxNodes": len(bx_nodes),
            "connectedB7Nodes": len(connected_b7),
            "unionNodes": len(allowed),
        }

    weighted_in: Counter[str] = Counter()
    weighted_out: Counter[str] = Counter()
    for source, target in graph_edges:
        weight = edge_counts[(source, target)]
        weighted_out[source] += weight
        weighted_in[target] += weight
    nodes = []
    country_counts: Counter[str] = Counter()
    tech_counts: Counter[str] = Counter()
    industry_counts: Counter[str] = Counter()
    for node_id in ordered:
        family_id = family_by_node[node_id]
        row = record_by_family[family_id]
        node_date = dates[node_id]
        country_match = re.match(r"^([A-Z]{2})", node_id)
        country_code = country_match.group(1) if country_match else "OT"
        country_counts[country_code] += 1
        technology = str(row["technology_code"] or "")
        industry = str(row["chain_level1"] or "")
        tech_counts[technology or "未分类"] += 1
        industry_counts[industry or "未分类"] += 1
        nodes.append({
            "id": node_id,
            "label": node_id.split("#", 1)[0],
            "country": country_code,
            "role": "both" if weighted_in[node_id] or weighted_out[node_id] else "pn",
            "members": family_members[family_id],
            "memberCount": len(family_members[family_id]),
            "date": node_date.isoformat() if node_date else "",
            "year": node_date.year if node_date else row["priority_year"],
            "timeValue": node_date.toordinal() if node_date else None,
            "in": len(predecessors.get(node_id, ())),
            "out": len(successors.get(node_id, ())),
            "win": weighted_in[node_id],
            "wout": weighted_out[node_id],
            "degree": len(predecessors.get(node_id, ())) + len(successors.get(node_id, ())),
            "wdegree": weighted_in[node_id] + weighted_out[node_id],
            "chainIn": len(predecessors.get(node_id, ())),
            "chainOut": len(successors.get(node_id, ())),
            "chainDegree": len(predecessors.get(node_id, ())) + len(successors.get(node_id, ())),
            "inEdgeSpc": in_spc[node_id],
            "outEdgeSpc": out_spc[node_id],
            "adjacentEdgeSpc": in_spc[node_id] + out_spc[node_id],
            "rows": [row["source_patent_id"]],
            "title": str(row["标题 (中文)"] or row["标题 (英文)"] or ""),
            "abstract": str(row["摘要 (中文)"] or row["摘要 (英文)"] or ""),
            "industryDimension": industry,
            "industryLevel1": industry,
            "industryLevel2": str(row["chain_level2"] or ""),
            "industryLevel3": str(row["chain_level3"] or ""),
            "technologyDimension": technology,
            "technicalFeature": str(row["technical_feature"] or ""),
            "applicantType": owner_types.get(family_id, ""),
            "applicantCountry": applicant_countries.get(family_id, ""),
            "province": applicant_provinces.get(family_id, ""),
            "city": applicant_cities.get(family_id, ""),
            "applicantChineseName": applicant_names.get(family_id, ""),
        })
    edges = [{
        "source": source,
        "target": target,
        "weight": edge_counts[(source, target)],
        "chain": True,
        "spc": edge_spc[(source, target)],
        "spnp": 0,
    } for source, target in graph_edges]
    edges.sort(key=lambda item: (-item["spc"], item["source"], item["target"]))
    dated_nodes = [node for node in nodes if node["timeValue"] is not None]
    stats = {
        "sourceFile": Path(metadata.get("source_xlsx", database.name)).name,
        "sourceSize": database.stat().st_size,
        "sourceMtime": datetime.fromtimestamp(database.stat().st_mtime).isoformat(timespec="seconds"),
        "records": len(records),
        "rawPn": sum(len(value) for value in family_members.values()),
        "rawCp": raw_cp,
        "sourcePnFile": Path(metadata.get("source_xlsx", database.name)).name,
        "sourcePnRows": len(records),
        "families": len(records),
        "sourceFamilies": len(records),
        "hiddenInvalidDimensionFamilies": len(all_nodes - network_nodes),
        "uniquePn": len(patent_to_family),
        "uniqueCp": len(external_cp) + len(graph_edges),
        "nodes": len(nodes),
        "edges": len(edges),
        "chainNodes": sum(bool(node["chainDegree"]) for node in nodes),
        "chainEdges": len(edges),
        "timeFilteredChainEdges": time_reversed + same_time_order_removed,
        "datedNodes": len(dated_nodes),
        "nodesWithChineseName": sum(bool(node["applicantChineseName"]) for node in nodes),
        "minTime": min((node["timeValue"] for node in dated_nodes), default=None),
        "maxTime": max((node["timeValue"] for node in dated_nodes), default=None),
        "minYear": min((node["year"] for node in dated_nodes), default=None),
        "maxYear": max((node["year"] for node in dated_nodes), default=None),
        "maxEdgeSpc": max(edge_spc.values(), default=0),
        "maxEdgeSpnp": 0,
        "maxAdjacentEdgeSpc": max((node["adjacentEdgeSpc"] for node in nodes), default=0),
        "maxChainDegree": max((node["chainDegree"] for node in nodes), default=1),
        "maxWeight": max(edge_counts.values(), default=1),
        "countries": country_counts.most_common(),
        "roles": dict(Counter(node["role"] for node in nodes)),
        "industryDimensions": industry_counts.most_common(),
        "technologyDimensions": tech_counts.most_common(),
        "dimensionConfig": {
            "maxGroups": 10,
            "industryEnabled": True,
            "technologyEnabled": True,
            "industryColumn": "产业链一级标签",
            "technologyColumn": "B技术分类",
            "industryObservedGroups": len(industry_counts),
            "technologyObservedGroups": len(tech_counts),
            "industryOrder": INDUSTRY_ORDER,
            "technologyOrder": TECHNOLOGY_ORDER,
            "industryLabels": {value: value for value in INDUSTRY_ORDER},
            "technologyLabels": TECHNOLOGY_LABELS,
            "mode": "dimension",
        },
    }
    spc_rows = path_rows(top_spc, "SPC", node_labels)
    diverse_rows = path_rows(top_diverse, "SPC", node_labels)
    graph = {
        "nodes": nodes,
        "edges": edges,
        "stats": stats,
        "topSpcPaths": spc_rows,
        "topGlobalSpcPaths": spc_rows,
        "topDiverseSpcPaths": diverse_rows,
        "topKeyRouteSpcPaths": diverse_rows[:5],
        "topTechnologyPaths": {},
        "topUnionTechnologyPaths": [],
        "topBxB7TechnologyPaths": bx_b7_paths,
        "bxB7PathGroupMeta": bx_b7_meta,
        "industryOrder": INDUSTRY_ORDER,
        "technologyOrder": TECHNOLOGY_ORDER,
        "industryLabels": {value: value for value in INDUSTRY_ORDER},
        "technologyLabels": TECHNOLOGY_LABELS,
        "dashboardMeta": {
            "title": "核聚变专利技术演进洞察",
            "inputFile": Path(metadata.get("source_xlsx", database.name)).name,
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "dataScope": "IncoPat；简单专利族口径；引文方向为被引专利族到引用专利族；全量分析展示 B0–B9，引文网络不计 B0 与技术路线缺失产业二级节点",
            "cyclePolicy": "逆时间引用及同日成环方向边不进入主路径计算",
        },
    }
    payload = json.dumps(graph, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    output.write_text(f"window.FUSION_DASHBOARD_DATA={payload};\n", encoding="utf-8")
    connection.close()
    print(f"Wrote {output}")
    print(f"Families: {len(nodes):,}")
    print(f"Edges: {len(edges):,}")
    print(f"Removed reversed/same-time cycle edges: {time_reversed:,}/{same_time_order_removed:,}")
    print(f"Diverse SPC paths: {len(diverse_rows)}")
    print("B1-B6 paths:", {code: len(paths) for code, paths in bx_b7_paths.items()})


if __name__ == "__main__":
    main()
