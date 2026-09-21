from __future__ import annotations

import argparse
import html
import itertools
import json
import math
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd

from src.deepseek_topic_interpreter import ensure_topic_interpretations
from src.deepseek_direction_summarizer import ensure_single_metric_direction_summaries
from src.visualization import METRIC_LABELS, METRICS, load_topic_scores

BASE_DIR = Path(os.environ.get("FUSION_TOPIC_BASE_DIR", "/mnt/d/工作/核聚变卡脖子/Lens_IPC"))
BASE_DIR_RESOLVED = BASE_DIR.resolve()


def data_path(path: Path | str) -> Path:
    path = Path(path)
    resolved = path if path.is_absolute() else BASE_DIR / path
    try:
        resolved.resolve().relative_to(BASE_DIR_RESOLVED)
    except ValueError as exc:
        raise ValueError(f"Path must be under {BASE_DIR}: {resolved}") from exc
    return resolved

SORTER_RESULT_LIMIT = 10
DOC_TOPIC_SHEET_NAMES = [
    "02_doc_topics",
    "doc_topics",
    "documents",
]
PATENT_TREND_YEARS = 20
IPC_SUBCLASS_RE = re.compile(r"[A-HY][0-9]{2}[A-Z]")
IPC_TOP_N = 6
IPC_OTHER_LABEL = "其他"
DEFAULT_TOPIC_WORKBOOK = data_path("merged_families_patentbert_topic_indicators.xlsx")
DEFAULT_DASHBOARD_HTML = data_path("merged_families_topic_interactive_dashboard.html")
DEFAULT_INTERPRET_CACHE = data_path("merged_families_topic_route_interpretations.json")
DEFAULT_DIRECTION_SUMMARY_CACHE = data_path("merged_families_single_metric_top10_direction_summaries.json")
TOPIC_TEXT_FIELDS = [
    "route_name_cn",
    "route_name_en",
    "topic_summary",
    "topic_description",
    "technology_route_sentences",
    "evidence_sentences",
    "fusion_industry_chain_position",
    "fusion_industry_chain_relation",
    "fusion_application_scenarios",
    "confidence",
    "deepseek_status",
]


METRIC_EXPLANATIONS = {
    "impact_score": "衡量该主题所包含文献或专利在后续知识生产中的被引用程度",
    "novelty_score": "衡量该主题在时间维度上的近期性，通常以主题内文献或专利的平均年份表示",
    "short_trend_score": "衡量该主题在近期时间窗口内的增长态势",
    "long_trend_score": "衡量该主题在较长时间跨度内的持续增长趋势",
    "centrality_score": "衡量该主题与其他主题在语义空间中的平均相似程度",
    "cross_domain_score": "衡量该主题所涉及 IPC subclass 的分布分散程度",
    "lof_score": "衡量该主题在语义空间中相对于其他主题的偏离程度",
}


METRIC_AXIS_EXPLANATIONS = {
    "impact_score": "高分表示该主题具有较高的知识扩散能力和技术影响力",
    "novelty_score": "高分表示该主题整体出现时间较新，具有较强的新兴特征",
    "short_trend_score": "高分表示该主题在近年内关注度或产出数量快速上升，具有短期升温特征",
    "long_trend_score": "高分表示该主题具有较稳定的长期发展动能",
    "centrality_score": "高分表示该主题与整体技术知识结构联系紧密，处于相对核心或连接性较强的位置",
    "cross_domain_score": "高分表示该主题跨越多个技术领域，具有较强的技术交叉与融合特征",
    "lof_score": "高分表示该主题具有较强的异质性或非典型性，可能代表边缘方向、替代路径或潜在新兴技术路线",
}


def finite_float(value) -> float | None:
    if pd.isna(value):
        return None
    value = float(value)
    if not np.isfinite(value):
        return None
    return value


def clean_text_value(value) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value)


def split_sentence_field(value) -> list[str]:
    text = clean_text_value(value).strip()
    if not text:
        return []
    return [part.strip() for part in text.split("||") if part.strip()]


def workbook_interpretation_from_topic(topic: dict) -> dict | None:
    if not topic.get("topic_summary") and not topic.get("topic_description"):
        return None
    return {
        "route_name_cn": topic.get("route_name_cn") or "主题提炼",
        "route_name_en": topic.get("route_name_en") or "",
        "meaning": topic.get("topic_description") or topic.get("topic_summary") or "",
        "technology_route": split_sentence_field(topic.get("technology_route_sentences")),
        "key_components": split_sentence_field(topic.get("evidence_sentences")),
        "fusion_industry_chain_position": topic.get("fusion_industry_chain_position") or "关系尚不明确",
        "fusion_industry_chain_relation": topic.get("fusion_industry_chain_relation") or "代表专利尚未提供足够证据判断其与核聚变产业链的具体关系。",
        "application_scenarios": split_sentence_field(topic.get("fusion_application_scenarios")),
        "signal_notes": topic.get("topic_summary") or "",
        "confidence": topic.get("confidence") or "unknown",
        "keyword_evidence": split_sentence_field(topic.get("evidence_sentences")),
        "status": "generated",
        "source": "cluster_deepseek_topic_summary",
    }


def workbook_interpretations(payload: dict) -> dict[str, dict]:
    out = {}
    for topic in payload.get("topics", []):
        interpretation = workbook_interpretation_from_topic(topic)
        if interpretation:
            out[str(topic["topic_id"])] = interpretation
    return out


def sorter_metric_value(topic: dict, metric: str) -> float:
    value = topic.get("scores", {}).get(metric)
    return float(value) if value is not None and math.isfinite(float(value)) else float("-inf")


def sorter_rank_key(topic: dict, selected_metrics: tuple[str, ...]) -> tuple[float, ...]:
    composite = 0.0
    total = len(selected_metrics)
    for index, metric in enumerate(selected_metrics):
        value = sorter_metric_value(topic, metric)
        if math.isfinite(value):
            composite += value * (2 ** (total - index - 1))
    tie_breakers = tuple(sorter_metric_value(topic, metric) for metric in selected_metrics)
    return (composite, *tie_breakers, -float(topic["topic_id"]))


def compute_sorter_interpret_topic_ids(topics: list[dict], result_limit: int = SORTER_RESULT_LIMIT) -> list[int]:
    topic_ids: set[int] = set()
    for size in range(1, len(METRICS) + 1):
        for selected_metrics in itertools.permutations(METRICS, size):
            ranked = sorted(topics, key=lambda topic: sorter_rank_key(topic, selected_metrics), reverse=True)
            topic_ids.update(int(topic["topic_id"]) for topic in ranked[:result_limit])
    return sorted(topic_ids)


def dashboard_interpret_topic_ids(topics: list[dict], top5: dict, initial_topic_id: int) -> list[int]:
    topic_ids = set(compute_sorter_interpret_topic_ids(topics))
    topic_ids.add(int(initial_topic_id))
    for items in top5.values():
        topic_ids.update(int(item["topic_id"]) for item in items)
    return sorted(topic_ids)


def topic_metric_item(topic: dict, metric: str) -> dict:
    item = {
        "topic_id": topic["topic_id"],
        "topic_size": topic["topic_size"],
        "score": topic["scores"].get(metric),
        "relative": topic["relative"].get(metric),
        "rank": topic["rank"].get(metric),
        "topic_keywords": topic["topic_keywords"],
    }
    for field in TOPIC_TEXT_FIELDS:
        item[field] = topic.get(field, "")
    return item


def interpretation_payload(payload: dict) -> dict:
    topic_ids = set(payload["interpretTopicIds"])
    topics = [topic for topic in payload["topics"] if topic["topic_id"] in topic_ids]
    top5 = {
        metric: [topic_metric_item(topic, metric) for topic in topics]
        for metric in payload["metrics"]
    }
    return {**payload, "topics": topics, "top5": top5}


def empty_period_counts() -> pd.DataFrame:
    return pd.DataFrame(columns=["topic_id", "period_start", "period_label", "topic_period_count", "total_period_count"])


def year_start(value: pd.Timestamp) -> pd.Timestamp:
    return pd.Timestamp(value.year, 1, 1)


def year_label(value: pd.Timestamp) -> str:
    return str(value.year)


def trend_start(reference_date: pd.Timestamp | None = None) -> pd.Timestamp:
    reference = pd.Timestamp.today().normalize() if reference_date is None else pd.Timestamp(reference_date).normalize()
    return pd.Timestamp(reference.year - PATENT_TREND_YEARS + 1, 1, 1)


def trend_periods(reference_date: pd.Timestamp | None = None) -> list[pd.Timestamp]:
    reference = pd.Timestamp.today().normalize() if reference_date is None else pd.Timestamp(reference_date).normalize()
    end = year_start(reference)
    periods: list[pd.Timestamp] = []
    current = trend_start(reference)
    while current <= end:
        periods.append(current)
        current = current + pd.DateOffset(years=1)
    return periods


def load_topic_period_counts(path: Path | str) -> pd.DataFrame:
    input_path = Path(path)
    if not input_path.exists():
        return empty_period_counts()

    if input_path.suffix.lower() in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(input_path)
        sheet = next((name for name in DOC_TOPIC_SHEET_NAMES if name in xls.sheet_names), None)
        if sheet is None:
            return empty_period_counts()
        docs = pd.read_excel(input_path, sheet_name=sheet)
    else:
        docs = pd.read_csv(input_path, encoding="utf-8-sig")

    date_column = next(
        (
            column
            for column in ["source_publication_date", "Publication Date", "publication_date", "date"]
            if column in docs.columns
        ),
        None,
    )
    if "topic_id" not in docs.columns or date_column is None:
        return empty_period_counts()

    out = docs[["topic_id", date_column]].copy()
    out["topic_id"] = pd.to_numeric(out["topic_id"], errors="coerce")
    out["publication_date"] = pd.to_datetime(out[date_column], errors="coerce")
    today = pd.Timestamp.today().normalize()
    start = trend_start(today)
    out = out.dropna(subset=["topic_id", "publication_date"]).copy()
    out = out[(out["publication_date"] >= start) & (out["publication_date"] <= today)].copy()
    if out.empty:
        return empty_period_counts()

    out["topic_id"] = out["topic_id"].astype(int)
    out["period_start"] = out["publication_date"].map(year_start)

    topic_counts = (
        out.groupby(["topic_id", "period_start"], as_index=False)
        .size()
        .rename(columns={"size": "topic_period_count"})
    )
    total_counts = (
        out.groupby("period_start", as_index=False)
        .size()
        .rename(columns={"size": "total_period_count"})
    )
    result = topic_counts.merge(total_counts, on="period_start", how="left")
    result["period_label"] = result["period_start"].map(year_label)
    return result[["topic_id", "period_start", "period_label", "topic_period_count", "total_period_count"]]


def patent_counts_by_topic_period(
    period_counts: pd.DataFrame | None,
    topic_ids: list[int],
) -> tuple[list[dict], dict[int, list[dict]]]:
    periods = trend_periods()
    period_payload = [
        {"period": period.date().isoformat(), "label": year_label(period)}
        for period in periods
    ]
    if period_counts is None or period_counts.empty:
        return period_payload, {
            int(topic_id): [{**period, "count": 0} for period in period_payload]
            for topic_id in topic_ids
        }

    required = {"topic_id", "period_start", "topic_period_count"}
    if not required.issubset(period_counts.columns):
        return period_payload, {
            int(topic_id): [{**period, "count": 0} for period in period_payload]
            for topic_id in topic_ids
        }

    topic_id_set = {int(topic_id) for topic_id in topic_ids}
    counts = period_counts[period_counts["topic_id"].isin(topic_id_set)].copy()
    counts["period_start"] = pd.to_datetime(counts["period_start"], errors="coerce")
    counts = counts.dropna(subset=["period_start"]).copy()

    grouped = counts.groupby(["topic_id", "period_start"], as_index=False)["topic_period_count"].sum()
    lookup = {
        (int(row["topic_id"]), pd.Timestamp(row["period_start"]).date().isoformat()): int(
            round(float(row["topic_period_count"]))
        )
        for _, row in grouped.iterrows()
    }

    series_by_topic = {
        int(topic_id): [
            {**period, "count": max(0, lookup.get((int(topic_id), period["period"]), 0))}
            for period in period_payload
        ]
        for topic_id in topic_ids
    }
    return period_payload, series_by_topic


def growth_rates_by_topic_period(patent_counts_by_topic: dict[int, list[dict]]) -> dict[int, list[dict]]:
    growth_by_topic: dict[int, list[dict]] = {}
    for topic_id, series in patent_counts_by_topic.items():
        rows = []
        previous_count: int | None = None
        for item in series:
            count = int(item.get("count", 0) or 0)
            if previous_count is None:
                growth_rate = None
            elif previous_count == 0:
                growth_rate = 0.0 if count == 0 else None
            else:
                growth_rate = (count - previous_count) / previous_count
            rows.append(
                {
                    "period": item.get("period", ""),
                    "label": item.get("label", ""),
                    "count": count,
                    "previous_count": previous_count,
                    "growth_rate": growth_rate,
                }
            )
            previous_count = count
        growth_by_topic[int(topic_id)] = rows
    return growth_by_topic


def split_ipc_subclasses(value) -> list[str]:
    text = clean_text_value(value).upper()
    if not text:
        return []
    matches = IPC_SUBCLASS_RE.findall(text)
    if matches:
        return list(dict.fromkeys(matches))
    parts = re.split(r"[;,|/\s]+", text)
    return list(dict.fromkeys(part for part in parts if IPC_SUBCLASS_RE.fullmatch(part)))


def empty_ipc_year_distribution(topic_ids: list[int]) -> dict[int, dict]:
    years = list(range(trend_start().year, pd.Timestamp.today().year + 1))
    return {
        int(topic_id): {
            "codes": [],
            "years": [{"year": int(year), "total": 0, "segments": []} for year in years],
        }
        for topic_id in topic_ids
    }


def load_topic_ipc_year_distribution(path: Path | str, topic_ids: list[int]) -> dict[int, dict]:
    input_path = Path(path)
    topic_id_set = {int(topic_id) for topic_id in topic_ids}
    if not input_path.exists() or not topic_id_set:
        return empty_ipc_year_distribution(topic_ids)

    if input_path.suffix.lower() in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(input_path)
        sheet = next((name for name in DOC_TOPIC_SHEET_NAMES if name in xls.sheet_names), None)
        if sheet is None:
            return empty_ipc_year_distribution(topic_ids)
        docs = pd.read_excel(input_path, sheet_name=sheet)
    else:
        docs = pd.read_csv(input_path, encoding="utf-8-sig")

    date_column = next(
        (
            column
            for column in ["source_publication_date", "Publication Date", "publication_date", "date"]
            if column in docs.columns
        ),
        None,
    )
    ipc_column = next((column for column in ["ipc_subclasses", "IPCR Classifications", "ipc_raw", "IPC"] if column in docs.columns), None)
    if "topic_id" not in docs.columns or date_column is None or ipc_column is None:
        return empty_ipc_year_distribution(topic_ids)

    out = docs[["topic_id", date_column, ipc_column]].copy()
    out["topic_id"] = pd.to_numeric(out["topic_id"], errors="coerce")
    out["publication_date"] = pd.to_datetime(out[date_column], errors="coerce")
    today = pd.Timestamp.today().normalize()
    start = trend_start(today)
    out = out.dropna(subset=["topic_id", "publication_date"]).copy()
    out = out[(out["publication_date"] >= start) & (out["publication_date"] <= today)].copy()
    out = out[out["topic_id"].astype(int).isin(topic_id_set)].copy()
    if out.empty:
        return empty_ipc_year_distribution(topic_ids)

    out["topic_id"] = out["topic_id"].astype(int)
    out["year"] = out["publication_date"].dt.year.astype(int)
    out["_ipc_list"] = out[ipc_column].map(split_ipc_subclasses)
    exploded = out.explode("_ipc_list")
    exploded = exploded.dropna(subset=["_ipc_list"]).copy()
    exploded = exploded[exploded["_ipc_list"].astype(str).str.len().gt(0)]
    if exploded.empty:
        return empty_ipc_year_distribution(topic_ids)

    grouped = (
        exploded.groupby(["topic_id", "year", "_ipc_list"], as_index=False)
        .size()
        .rename(columns={"_ipc_list": "ipc", "size": "count"})
    )
    years = list(range(start.year, today.year + 1))
    result = empty_ipc_year_distribution(topic_ids)

    for topic_id in topic_id_set:
        topic_counts = grouped[grouped["topic_id"].eq(topic_id)].copy()
        if topic_counts.empty:
            continue
        totals_by_code = topic_counts.groupby("ipc")["count"].sum().sort_values(ascending=False)
        top_codes = [str(code) for code in totals_by_code.head(IPC_TOP_N).index.tolist()]
        display_codes = top_codes + ([IPC_OTHER_LABEL] if len(totals_by_code) > len(top_codes) else [])
        rows = []
        for year in years:
            year_counts = topic_counts[topic_counts["year"].eq(year)]
            counter = {str(row["ipc"]): int(row["count"]) for _, row in year_counts.iterrows()}
            other_count = sum(count for code, count in counter.items() if code not in top_codes)
            segments = [{"code": code, "count": int(counter.get(code, 0))} for code in top_codes]
            if IPC_OTHER_LABEL in display_codes:
                segments.append({"code": IPC_OTHER_LABEL, "count": int(other_count)})
            total = int(sum(segment["count"] for segment in segments))
            rows.append({"year": int(year), "total": total, "segments": segments})
        result[int(topic_id)] = {"codes": display_codes, "years": rows}

    return result


def build_dashboard_payload(
    df: pd.DataFrame,
    topn: int,
    initial_topic_id: int | None,
    period_counts: pd.DataFrame | None = None,
    ipc_year_distribution: dict[int, dict] | None = None,
) -> dict:
    data = df.copy()
    data["topic_id"] = data["topic_id"].astype(int)
    raw_topic_count = int(data["topic_id"].nunique())
    data = data[data["topic_id"].ne(-1)].copy()
    if data.empty:
        raise ValueError("No topics remain after excluding topic_id = -1.")
    data = data.reset_index(drop=True)
    visible_topic_ids = [int(topic_id) for topic_id in data["topic_id"].tolist()]
    patent_trend_periods, patent_counts_by_topic = patent_counts_by_topic_period(
        period_counts=period_counts,
        topic_ids=visible_topic_ids,
    )
    growth_rates_by_topic = growth_rates_by_topic_period(patent_counts_by_topic)
    ipc_year_distribution = ipc_year_distribution or empty_ipc_year_distribution(visible_topic_ids)

    averages = {metric: finite_float(pd.to_numeric(data[metric], errors="coerce").mean(skipna=True)) for metric in METRICS}
    ranks = {
        metric: pd.to_numeric(data[metric], errors="coerce").rank(method="min", ascending=False, na_option="bottom")
        for metric in METRICS
    }

    topics = []
    for _, row in data.iterrows():
        topic_id = int(row["topic_id"])
        scores = {}
        relatives = {}
        topic_ranks = {}
        top1 = {}
        for metric in METRICS:
            score = finite_float(row[metric])
            avg = averages[metric]
            scores[metric] = score
            relatives[metric] = score / avg if score is not None and avg not in (None, 0) else None
            rank = ranks[metric].loc[row.name]
            topic_ranks[metric] = int(rank) if pd.notna(rank) else None
            top1[metric] = bool(pd.notna(rank) and int(rank) == 1)

        topic = {
            "topic_id": topic_id,
            "topic_size": None if pd.isna(row.get("topic_size", np.nan)) else int(row.get("topic_size")),
            "is_bertopic_outlier": bool(row.get("is_bertopic_outlier", False)),
            "topic_keywords": clean_text_value(row.get("topic_keywords", "")),
            "scores": scores,
            "relative": relatives,
            "rank": topic_ranks,
            "top1": top1,
            "recent_patent_counts": patent_counts_by_topic.get(topic_id, []),
            "growth_rate_series": growth_rates_by_topic.get(topic_id, []),
            "ipc_year_distribution": ipc_year_distribution.get(topic_id, {"codes": [], "years": []}),
        }
        for field in TOPIC_TEXT_FIELDS:
            topic[field] = clean_text_value(row.get(field, ""))
        topics.append(topic)

    topics_by_id = {topic["topic_id"]: topic for topic in topics}
    top5 = {}
    for metric in METRICS:
        ranked = data.dropna(subset=[metric]).sort_values(metric, ascending=False).head(topn)
        items = []
        for _, row in ranked.iterrows():
            topic_id = int(row["topic_id"])
            topic = topics_by_id[topic_id]
            items.append(
                {
                    "topic_id": topic_id,
                    "topic_size": topic["topic_size"],
                    "score": finite_float(row[metric]),
                    "relative": topic["relative"][metric],
                    "rank": topic["rank"][metric],
                    "topic_keywords": topic["topic_keywords"],
                }
            )
        top5[metric] = items

    if initial_topic_id is None or initial_topic_id not in topics_by_id:
        preferred = top5.get("short_trend_score") or top5.get(METRICS[0]) or []
        initial_topic_id = int(preferred[0]["topic_id"]) if preferred else int(topics[0]["topic_id"])

    interpret_topic_ids = dashboard_interpret_topic_ids(topics, top5, int(initial_topic_id))
    return {
        "metrics": METRICS,
        "metricLabels": METRIC_LABELS,
        "metricExplanations": METRIC_EXPLANATIONS,
        "metricAxisExplanations": METRIC_AXIS_EXPLANATIONS,
        "averages": averages,
        "topics": topics,
        "top5": top5,
        "topN": int(topn),
        "sorterResultLimit": SORTER_RESULT_LIMIT,
        "interpretTopicIds": interpret_topic_ids,
        "patentTrendPeriods": patent_trend_periods,
        "initialTopicId": int(initial_topic_id),
        "excludedTopicIds": [-1],
        "rawTopicCount": raw_topic_count,
        "visibleTopicCount": int(data["topic_id"].nunique()),
    }


def write_dashboard_html(payload: dict, output_path: Path, input_label: str) -> None:
    payload_json = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    input_text = html.escape(input_label)
    html_doc = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>主题交互雷达图面板</title>
  <style>
    :root {{
      --bg: #f4f6f8;
      --panel: #ffffff;
      --line: #dce2e8;
      --text: #17212f;
      --muted: #647083;
      --primary: #005fb8;
      --primary-soft: rgba(0, 95, 184, 0.16);
      --accent: #b00020;
      --green: #007a63;
      font-family: Arial, "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      color: var(--text);
      background: var(--bg);
    }}
    .route-panel {{
      margin-top: 10px;
      border: 1px solid #dbe5ef;
      border-radius: 8px;
      background: #f8fbff;
      padding: 10px 12px;
    }}
    .route-panel h3 {{
      margin: 0 0 6px;
      font-size: 14px;
      color: #17212f;
    }}
    .route-panel p {{
      margin: 5px 0;
      color: #344255;
      line-height: 1.38;
      font-size: 12px;
    }}
    .route-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 7px;
    }}
    .route-block {{
      min-width: 0;
    }}
    .route-label {{
      font-size: 12px;
      font-weight: 800;
      color: #526174;
      margin-bottom: 3px;
    }}
    .route-list {{
      margin: 0;
      padding-left: 17px;
      color: #344255;
      font-size: 11.5px;
      line-height: 1.34;
    }}
    .route-status {{
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      background: #e7edf4;
      color: #526174;
      font-size: 12px;
      font-weight: 700;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
    }}
    .shell {{
      display: grid;
      grid-template-columns: minmax(560px, 1fr) 430px;
      gap: 18px;
      height: 100vh;
      padding: 18px;
    }}
    .main, .side {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      min-width: 0;
    }}
    .main {{
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
    }}
    .topic-header {{
      padding: 18px 20px 12px;
      border-bottom: 1px solid var(--line);
    }}
    h1 {{
      margin: 0;
      font-size: 24px;
      letter-spacing: 0;
    }}
    .topic-meta {{
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
    }}
    .keywords {{
      margin: 10px 0 0;
      color: #384556;
      line-height: 1.45;
      font-size: 14px;
    }}
    .chart-area {{
      position: relative;
      display: grid;
      justify-items: center;
      align-content: start;
      padding: 0 18px 18px;
      min-height: 0;
      overflow-y: auto;
    }}
    #radar {{
      width: min(650px, 100%);
      max-height: 52vh;
      aspect-ratio: 1 / 1;
      overflow: visible;
      transform: translateY(-28px);
      margin-bottom: -42px;
    }}
    .trend-panel {{
      width: min(700px, 100%);
      border: 1px solid #dbe5ef;
      border-radius: 8px;
      background: #fbfdff;
      padding: 12px 14px 10px;
      margin-bottom: 4px;
    }}
    .trend-head {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
    }}
    .trend-head h2 {{
      margin: 0;
      font-size: 15px;
      color: #17212f;
    }}
    .trend-summary {{
      color: var(--muted);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }}
    #patentTrend, #growthTrend, #ipcDistribution {{
      width: 100%;
      height: 190px;
      display: block;
      overflow: visible;
    }}
    #ipcDistribution {{
      height: 230px;
    }}
    .trend-axis {{
      stroke: #aeb8c4;
      stroke-width: 1.2;
      fill: none;
    }}
    .trend-grid {{
      stroke: #e1e7ee;
      stroke-width: 1;
      fill: none;
    }}
    .trend-line {{
      stroke: var(--green);
      stroke-width: 3;
      stroke-linejoin: round;
      stroke-linecap: round;
      fill: none;
    }}
    .growth-line {{
      stroke: #b23b3b;
      stroke-width: 3;
      stroke-linejoin: round;
      stroke-linecap: round;
      fill: none;
    }}
    .zero-line {{
      stroke: #9aa6b2;
      stroke-width: 1.2;
      stroke-dasharray: 5 5;
      fill: none;
    }}
    .ipc-segment {{
      stroke: #ffffff;
      stroke-width: 1;
      shape-rendering: crispEdges;
    }}
    .ipc-legend {{
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      min-height: 22px;
      margin-top: 4px;
      color: #526174;
      font-size: 12px;
    }}
    .legend-item {{
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }}
    .legend-swatch {{
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }}
    .trend-label {{
      fill: #526174;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }}
    .trend-value {{
      fill: #17212f;
      font-size: 12px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }}
    .trend-empty {{
      fill: #647083;
      font-size: 14px;
      font-weight: 700;
    }}
    .grid-line, .axis-line {{
      stroke: #d7dde4;
      stroke-width: 1;
      fill: none;
    }}
    .avg-ring {{
      stroke: #858f9c;
      stroke-width: 1.8;
      stroke-dasharray: 6 6;
      fill: none;
    }}
    .radar-shape {{
      fill: var(--primary-soft);
      stroke: var(--primary);
      stroke-width: 3;
      stroke-linejoin: round;
    }}
    .radar-point {{
      fill: #ffffff;
      stroke: var(--primary);
      stroke-width: 2.4;
      transition: r 180ms ease;
    }}
    .radar-point.top1 {{
      fill: var(--accent);
      stroke: #ffffff;
      stroke-width: 2;
    }}
    .axis-label {{
      fill: #263241;
      font-size: 14px;
      font-weight: 700;
      cursor: help;
    }}
    .tick-label {{
      fill: #667386;
      font-size: 11px;
    }}
    .top1-label {{
      fill: var(--accent);
      font-size: 12px;
      font-weight: 700;
      opacity: 0;
      transition: opacity 260ms ease;
    }}
    .top1-label.show {{
      opacity: 1;
    }}
    .side {{
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }}
    .side-head {{
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--line);
    }}
    .side-head h2 {{
      margin: 0;
      font-size: 18px;
    }}
    .source {{
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }}
    .top-list {{
      overflow-y: auto;
      padding: 12px;
    }}
    .metric-group {{
      margin-bottom: 14px;
      border: 1px solid #e2e7ed;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }}
    .metric-title {{
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      background: #f2f5f8;
      font-weight: 700;
      color: #263241;
      font-size: 14px;
      cursor: help;
    }}
    .metric-explanation {{
      border-top: 1px solid #edf0f3;
      background: #fbfcfe;
      padding: 9px 12px 10px;
      color: #4a5768;
      font-size: 12px;
      line-height: 1.45;
    }}
    .metric-explanation-label {{
      display: inline-block;
      margin-right: 6px;
      color: #263241;
      font-weight: 800;
    }}
    .sorter-panel {{
      padding: 10px 12px 12px;
    }}
    .sorter-controls {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }}
    .sorter-button {{
      border: 1px solid #d9e1ea;
      border-radius: 8px;
      background: #ffffff;
      color: #263241;
      cursor: pointer;
      min-width: 0;
      padding: 8px 9px;
      text-align: left;
      transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    }}
    .sorter-button:hover {{
      border-color: #9db9d8;
      background: #f7fbff;
    }}
    .sorter-button.active {{
      border-color: var(--primary);
      background: #eaf3ff;
      box-shadow: inset 3px 0 0 var(--primary);
    }}
    .sorter-button-head {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: 800;
      font-size: 13px;
    }}
    .sorter-order {{
      flex: 0 0 auto;
      min-width: 22px;
      height: 20px;
      border-radius: 999px;
      background: #e7edf4;
      color: #526174;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
    }}
    .sorter-button.active .sorter-order {{
      background: var(--primary);
      color: #ffffff;
    }}
    .sorter-note {{
      margin-top: 5px;
      color: var(--muted);
      font-size: 11.5px;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .sorter-status {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }}
    .sorter-reset {{
      border: 0;
      border-radius: 999px;
      background: #e7edf4;
      color: #526174;
      cursor: pointer;
      flex: 0 0 auto;
      font-size: 12px;
      font-weight: 800;
      padding: 5px 10px;
    }}
    .sorter-reset:hover {{
      background: #d9e4f0;
    }}
    .sorter-results {{
      margin-top: 12px;
      border: 1px solid #e2e7ed;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }}
    .sorter-results-title {{
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      background: #f2f5f8;
      color: #263241;
      font-size: 14px;
      font-weight: 800;
    }}
    .sorter-direction-summary {{
      padding: 8px 12px;
      border-top: 1px solid #e2e7ed;
      background: #f8fafc;
      color: #344255;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
    }}
    .sorter-empty {{
      padding: 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }}
    .sorter-breakdown {{
      margin-top: 5px;
      color: #526174;
      font-size: 12px;
      line-height: 1.35;
    }}
    .topic-button {{
      width: 100%;
      border: 0;
      border-top: 1px solid #edf0f3;
      background: #ffffff;
      text-align: left;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 180ms ease, transform 180ms ease;
    }}
    .topic-button:hover {{
      background: #f6f9fc;
    }}
    .topic-button.active {{
      background: #eaf3ff;
      box-shadow: inset 3px 0 0 var(--primary);
    }}
    .topic-button:active {{
      transform: translateY(1px);
    }}
    .topic-row {{
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }}
    .topic-id {{
      font-weight: 800;
      color: #17212f;
    }}
    .score {{
      font-variant-numeric: tabular-nums;
      color: var(--green);
      font-weight: 700;
    }}
    .topic-key {{
      margin-top: 5px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}
    .hover-tip {{
      position: fixed;
      z-index: 40;
      left: 0;
      top: 0;
      max-width: 360px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #17212f;
      color: #ffffff;
      box-shadow: 0 16px 34px rgba(15, 23, 42, 0.26);
      font-size: 12px;
      line-height: 1.45;
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px) scale(0.98);
      transition: opacity 140ms ease, transform 140ms ease;
    }}
    .hover-tip.show {{
      opacity: 1;
      transform: translateY(0) scale(1);
    }}
    .tip-title {{
      font-weight: 800;
      margin-bottom: 5px;
      color: #ffffff;
    }}
    .tip-muted {{
      color: #c8d1dd;
    }}
    @media (max-width: 1080px) {{
      .shell {{
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100vh;
      }}
      .main, .chart-area {{
        overflow: visible;
      }}
      .side {{
        max-height: none;
      }}
      #radar {{
        max-height: none;
        transform: translateY(-16px);
        margin-bottom: -26px;
      }}
      .trend-head {{
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
      }}
      .trend-summary {{
        text-align: left;
      }}
      .route-grid {{
        grid-template-columns: 1fr;
      }}
      .sorter-controls {{
        grid-template-columns: 1fr;
      }}
    }}
  </style>
</head>
<body>
  <div class="shell">
    <main class="main">
      <header class="topic-header">
        <h1 id="topicTitle">主题</h1>
        <div class="topic-meta">
          <span id="topicSize"></span>
          <span id="outlierFlag"></span>
          <span id="maxMetric"></span>
        </div>
        <p class="keywords" id="topicKeywords"></p>
        <section class="route-panel" id="routePanel"></section>
      </header>
      <section class="chart-area">
        <svg id="radar" viewBox="0 0 720 720" role="img" aria-label="主题雷达图"></svg>
        <section class="trend-panel" aria-label="近20年专利族数量折线图">
          <div class="trend-head">
            <h2>近20年专利族数量</h2>
            <span class="trend-summary" id="trendSummary"></span>
          </div>
          <svg id="patentTrend" viewBox="0 0 720 220" role="img" aria-label="近20年专利族数量折线图"></svg>
        </section>
        <section class="trend-panel" aria-label="年度增长率曲线">
          <div class="trend-head">
            <h2>近20年年度增长率</h2>
            <span class="trend-summary" id="growthSummary"></span>
          </div>
          <svg id="growthTrend" viewBox="0 0 720 220" role="img" aria-label="年度增长率曲线"></svg>
        </section>
        <section class="trend-panel" aria-label="年度IPC subclass分布">
          <div class="trend-head">
            <h2>年度 IPC subclass 分布</h2>
            <span class="trend-summary" id="ipcSummary"></span>
          </div>
          <svg id="ipcDistribution" viewBox="0 0 720 260" role="img" aria-label="年度IPC subclass分布"></svg>
          <div class="ipc-legend" id="ipcLegend"></div>
        </section>
      </section>
    </main>
    <aside class="side">
      <div class="side-head">
        <h2>指标排序器</h2>
        <div class="source">{input_text}<br>已排除 topic_id = -1</div>
      </div>
      <div class="top-list" id="topList"></div>
    </aside>
  </div>
  <div class="hover-tip" id="hoverTip"></div>
  <script id="dashboard-data" type="application/json">{payload_json}</script>
  <script>
    const payload = JSON.parse(document.getElementById('dashboard-data').textContent);
    const metrics = payload.metrics;
    const labels = payload.metricLabels;
    const explanations = payload.metricExplanations || {{}};
    const axisExplanations = payload.metricAxisExplanations || {{}};
    const resultLimit = payload.sorterResultLimit || 10;
    const interpretations = payload.interpretations || {{}};
    const singleMetricDirectionSummaries = payload.singleMetricDirectionSummaries || {{}};
    const topics = new Map(payload.topics.map(topic => [topic.topic_id, topic]));
    const center = 360;
    const radius = 238;
    const labelRadius = 296;
    const top1Radius = 268;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('radar');
    const trendSvg = document.getElementById('patentTrend');
    const trendSummary = document.getElementById('trendSummary');
    const growthSvg = document.getElementById('growthTrend');
    const growthSummary = document.getElementById('growthSummary');
    const ipcSvg = document.getElementById('ipcDistribution');
    const ipcSummary = document.getElementById('ipcSummary');
    const ipcLegend = document.getElementById('ipcLegend');
    const hoverTip = document.getElementById('hoverTip');
    let currentTopic = topics.get(payload.initialTopicId);
    let currentValues = metrics.map(metric => safeRelative(currentTopic, metric));
    let currentRMax = rMaxForValues(currentValues);
    let polygon;
    let pointNodes = [];
    let top1Labels = [];
    let tickNodes = [];
    let avgRing;
    let selectedSortMetrics = [];

    function createSvg(tag, attrs = {{}}) {{
      const node = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    }}

    function angleAt(index) {{
      return -Math.PI / 2 + (Math.PI * 2 * index / metrics.length);
    }}

    function coord(index, value, rMax, extra = 0) {{
      const angle = angleAt(index);
      const scaled = Math.max(0, Math.min(value / rMax, 1));
      const r = radius * scaled + extra;
      return {{
        x: center + Math.cos(angle) * r,
        y: center + Math.sin(angle) * r
      }};
    }}

    function coordAbsolute(index, absoluteRadius) {{
      const angle = angleAt(index);
      return {{
        x: center + Math.cos(angle) * absoluteRadius,
        y: center + Math.sin(angle) * absoluteRadius
      }};
    }}

    function safeRelative(topic, metric) {{
      const value = topic?.relative?.[metric];
      return Number.isFinite(value) ? value : 0;
    }}

    function rMaxForValues(values) {{
      const finite = values.filter(Number.isFinite);
      const maxValue = finite.length ? Math.max(...finite) : 1;
      return Math.min(3, Math.max(1.5, Math.ceil(maxValue * 2) / 2));
    }}

    function pointsFor(values, rMax) {{
      return values.map((value, index) => {{
        const p = coord(index, value, rMax);
        return `${{p.x.toFixed(2)}},${{p.y.toFixed(2)}}`;
      }}).join(' ');
    }}

    function ringPoints(value, rMax) {{
      return metrics.map((_, index) => {{
        const p = coord(index, value, rMax);
        return `${{p.x.toFixed(2)}},${{p.y.toFixed(2)}}`;
      }}).join(' ');
    }}

    function drawBase() {{
      svg.innerHTML = '';
      [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].forEach(tick => {{
        const ring = createSvg('polygon', {{ class: tick === 1 ? 'avg-ring' : 'grid-line', points: ringPoints(tick, currentRMax), 'data-tick': tick }});
        svg.appendChild(ring);
        if (tick !== 1) tickNodes.push(ring);
        else avgRing = ring;
      }});

      metrics.forEach((metric, index) => {{
        const end = coordAbsolute(index, radius);
        svg.appendChild(createSvg('line', {{ class: 'axis-line', x1: center, y1: center, x2: end.x, y2: end.y }}));
        const label = coordAbsolute(index, labelRadius);
        const text = createSvg('text', {{ class: 'axis-label', x: label.x, y: label.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }});
        text.textContent = labels[metric] || metric;
        text.addEventListener('mouseenter', event => showTip(event, axisMetricTooltip(metric)));
        text.addEventListener('mousemove', moveTip);
        text.addEventListener('mouseleave', hideTip);
        svg.appendChild(text);
      }});

      const tickLabel = createSvg('text', {{ class: 'tick-label', x: center + 8, y: center - radius / currentRMax, id: 'avgTickLabel' }});
      tickLabel.textContent = '1.0 均值';
      svg.appendChild(tickLabel);

      polygon = createSvg('polygon', {{ class: 'radar-shape', points: pointsFor(currentValues, currentRMax) }});
      svg.appendChild(polygon);

      metrics.forEach((metric, index) => {{
        const p = coord(index, currentValues[index], currentRMax);
        const circle = createSvg('circle', {{ class: 'radar-point', cx: p.x, cy: p.y, r: 5 }});
        pointNodes.push(circle);
        svg.appendChild(circle);
        const marker = coordAbsolute(index, top1Radius);
        const topLabel = createSvg('text', {{ class: 'top1-label', x: marker.x, y: marker.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }});
        topLabel.textContent = '第1';
        top1Labels.push(topLabel);
        svg.appendChild(topLabel);
      }});
    }}

    function updateGrid(rMax) {{
      svg.querySelectorAll('[data-tick]').forEach(node => {{
        const tick = Number(node.getAttribute('data-tick'));
        node.setAttribute('points', ringPoints(tick, rMax));
        node.style.display = tick <= rMax ? '' : 'none';
      }});
      const avgLabel = document.getElementById('avgTickLabel');
      if (avgLabel) {{
        avgLabel.setAttribute('y', center - radius / rMax);
      }}
    }}

    function easeOutCubic(t) {{
      return 1 - Math.pow(1 - t, 3);
    }}

    function animateRadar(nextTopic) {{
      const startValues = currentValues.slice();
      const targetValues = metrics.map(metric => safeRelative(nextTopic, metric));
      const startRMax = currentRMax;
      const targetRMax = rMaxForValues(targetValues);
      const startTime = performance.now();
      const duration = 520;

      function frame(now) {{
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOutCubic(t);
        const values = startValues.map((value, index) => value + (targetValues[index] - value) * eased);
        const rMax = startRMax + (targetRMax - startRMax) * eased;
        polygon.setAttribute('points', pointsFor(values, rMax));
        pointNodes.forEach((node, index) => {{
          const p = coord(index, values[index], rMax);
          node.setAttribute('cx', p.x);
          node.setAttribute('cy', p.y);
        }});
        updateGrid(rMax);
        if (t < 1) requestAnimationFrame(frame);
        else {{
          currentValues = targetValues;
          currentRMax = targetRMax;
          updateTop1Labels(nextTopic);
        }}
      }}
      requestAnimationFrame(frame);
    }}

    function niceTrendMax(value) {{
      if (!Number.isFinite(value) || value <= 0) return 1;
      if (value <= 5) return Math.ceil(value);
      const power = Math.pow(10, Math.floor(Math.log10(value)));
      const scaled = value / power;
      if (scaled <= 2) return 2 * power;
      if (scaled <= 5) return 5 * power;
      return 10 * power;
    }}

    function formatCount(value) {{
      return Number.isFinite(value) ? String(Math.round(value)) : '0';
    }}

    function patentTrendSeries(topic) {{
      if (Array.isArray(topic?.recent_patent_counts) && topic.recent_patent_counts.length) {{
        return topic.recent_patent_counts
          .map(item => ({{ period: String(item.period || ''), label: String(item.label || item.period || ''), count: Number(item.count) }}))
          .filter(item => item.period && item.label && Number.isFinite(item.count));
      }}
      const periods = Array.isArray(payload.patentTrendPeriods) ? payload.patentTrendPeriods : [];
      return periods
        .map(item => ({{ period: String(item.period || ''), label: String(item.label || item.period || ''), count: 0 }}))
        .filter(item => item.period && item.label);
    }}

    function trendX(index, length, left, width) {{
      if (length <= 1) return left + width / 2;
      return left + width * index / (length - 1);
    }}

    function shouldShowPeriodLabel(index, length) {{
      if (length <= 14) return true;
      if (length <= 26) return index % 2 === 0 || index === length - 1;
      return index % 4 === 0 || index === length - 1;
    }}

    function shouldShowPointValue(index, length) {{
      return length <= 16 || index === length - 1;
    }}

    function trendY(count, yMax, top, height) {{
      return top + height * (1 - Math.max(0, Math.min(count / yMax, 1)));
    }}

    function renderPatentTrend(topic) {{
      const series = patentTrendSeries(topic);
      trendSvg.innerHTML = '';
      if (!series.length) {{
        trendSummary.textContent = '暂无年度数据';
        const empty = createSvg('text', {{
          class: 'trend-empty',
          x: 360,
          y: 112,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        }});
        empty.textContent = '暂无年度数据';
        trendSvg.appendChild(empty);
        return;
      }}

      const left = 54;
      const right = 690;
      const top = 24;
      const bottom = 174;
      const width = right - left;
      const height = bottom - top;
      const counts = series.map(item => Math.max(0, item.count));
      const labels = series.map(item => item.label);
      const total = counts.reduce((sum, value) => sum + value, 0);
      const yMax = niceTrendMax(Math.max(...counts));
      const midTick = yMax <= 2 ? 1 : Math.round(yMax / 2);
      const yTicks = [...new Set([0, midTick, yMax])].sort((a, b) => a - b);

      trendSummary.textContent = `${{labels[0]}}-${{labels[labels.length - 1]}} 合计 ${{formatCount(total)}} 件`;

      yTicks.forEach(tick => {{
        const y = trendY(tick, yMax, top, height);
        trendSvg.appendChild(createSvg('line', {{ class: 'trend-grid', x1: left, y1: y, x2: right, y2: y }}));
        const label = createSvg('text', {{ class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' }});
        label.textContent = formatCount(tick);
        trendSvg.appendChild(label);
      }});

      trendSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }}));
      trendSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }}));

      const points = series.map((item, index) => ({{
        x: trendX(index, series.length, left, width),
        y: trendY(Math.max(0, item.count), yMax, top, height),
        period: item.period,
        label: item.label,
        count: Math.max(0, item.count)
      }}));
      const linePoints = points.map(point => `${{point.x.toFixed(2)}},${{point.y.toFixed(2)}}`).join(' ');
      trendSvg.appendChild(createSvg('polyline', {{ class: 'trend-line', points: linePoints }}));

      points.forEach((point, index) => {{
        if (shouldShowPeriodLabel(index, points.length)) {{
          const xLabel = createSvg('text', {{
            class: 'trend-label',
            x: point.x,
            y: bottom + 24,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          }});
          xLabel.textContent = point.label;
          trendSvg.appendChild(xLabel);
        }}

        if (shouldShowPointValue(index, points.length)) {{
          const valueLabel = createSvg('text', {{
            class: 'trend-value',
            x: point.x,
            y: Math.max(top + 10, point.y - 10),
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          }});
          valueLabel.textContent = formatCount(point.count);
          trendSvg.appendChild(valueLabel);
        }}

      }});
    }}

    function formatPercent(value) {{
      if (!Number.isFinite(value)) return '不可算';
      const percent = value * 100;
      const digits = Math.abs(percent) < 10 && percent !== 0 ? 1 : 0;
      return `${{percent.toFixed(digits)}}%`;
    }}

    function niceGrowthMax(value) {{
      if (!Number.isFinite(value) || value <= 0) return 1;
      if (value <= 0.5) return 0.5;
      if (value <= 1) return 1;
      if (value <= 2) return 2;
      if (value <= 5) return 5;
      return Math.ceil(value / 5) * 5;
    }}

    function growthY(value, maxAbs, top, height) {{
      const clipped = Math.max(-maxAbs, Math.min(value, maxAbs));
      return top + height * (1 - ((clipped + maxAbs) / (2 * maxAbs)));
    }}

    function renderGrowthTrend(topic) {{
      const series = Array.isArray(topic?.growth_rate_series) ? topic.growth_rate_series : [];
      growthSvg.innerHTML = '';
      const usable = series
        .map(item => ({{
          period: String(item.period || ''),
          label: String(item.label || item.period || ''),
          count: Number(item.count),
          previous_count: item.previous_count === null || item.previous_count === undefined ? null : Number(item.previous_count),
          growth_rate: item.growth_rate === null || item.growth_rate === undefined ? null : Number(item.growth_rate)
        }}))
        .filter(item => item.period && item.label && Number.isFinite(item.count));
      const finite = usable.filter(item => Number.isFinite(item.growth_rate));
      if (!usable.length || !finite.length) {{
        growthSummary.textContent = '暂无可计算增长率';
        const empty = createSvg('text', {{
          class: 'trend-empty',
          x: 360,
          y: 112,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        }});
        empty.textContent = '暂无可计算增长率';
        growthSvg.appendChild(empty);
        return;
      }}

      const left = 54;
      const right = 690;
      const top = 24;
      const bottom = 174;
      const width = right - left;
      const height = bottom - top;
      const maxAbs = niceGrowthMax(Math.max(...finite.map(item => Math.abs(item.growth_rate))));
      const labels = usable.map(item => item.label);
      const latest = [...finite].reverse()[0];
      const avg = finite.reduce((sum, item) => sum + item.growth_rate, 0) / finite.length;
      growthSummary.textContent = `${{labels[0]}}-${{labels[labels.length - 1]}} 最近 ${{formatPercent(latest.growth_rate)}} | 平均 ${{formatPercent(avg)}}`;

      [-maxAbs, 0, maxAbs].forEach(tick => {{
        const y = growthY(tick, maxAbs, top, height);
        growthSvg.appendChild(createSvg('line', {{
          class: tick === 0 ? 'zero-line' : 'trend-grid',
          x1: left,
          y1: y,
          x2: right,
          y2: y
        }}));
        const label = createSvg('text', {{ class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' }});
        label.textContent = formatPercent(tick);
        growthSvg.appendChild(label);
      }});

      growthSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }}));
      growthSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }}));

      const points = usable.map((item, index) => ({{
        x: trendX(index, usable.length, left, width),
        y: Number.isFinite(item.growth_rate) ? growthY(item.growth_rate, maxAbs, top, height) : null,
        label: item.label,
        count: item.count,
        previous_count: item.previous_count,
        growth_rate: item.growth_rate
      }}));

      let segment = [];
      points.forEach(point => {{
        if (point.y === null) {{
          if (segment.length >= 2) {{
            growthSvg.appendChild(createSvg('polyline', {{ class: 'growth-line', points: segment.map(p => `${{p.x.toFixed(2)}},${{p.y.toFixed(2)}}`).join(' ') }}));
          }}
          segment = [];
          return;
        }}
        segment.push(point);
      }});
      if (segment.length >= 2) {{
        growthSvg.appendChild(createSvg('polyline', {{ class: 'growth-line', points: segment.map(p => `${{p.x.toFixed(2)}},${{p.y.toFixed(2)}}`).join(' ') }}));
      }}

      points.forEach((point, index) => {{
        if (shouldShowPeriodLabel(index, points.length)) {{
          const xLabel = createSvg('text', {{
            class: 'trend-label',
            x: point.x,
            y: bottom + 24,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          }});
          xLabel.textContent = point.label;
          growthSvg.appendChild(xLabel);
        }}
      }});
    }}

    const ipcColors = ['#005fb8', '#007a63', '#b23b3b', '#7a5c00', '#725ac1', '#0086a8', '#8a94a6'];

    function renderIpcDistribution(topic) {{
      const payload = topic?.ipc_year_distribution || {{}};
      const years = Array.isArray(payload.years) ? payload.years : [];
      const codes = Array.isArray(payload.codes) ? payload.codes : [];
      ipcSvg.innerHTML = '';
      ipcLegend.innerHTML = '';
      const totalAll = years.reduce((sum, row) => sum + Number(row.total || 0), 0);
      if (!years.length || !codes.length || totalAll <= 0) {{
        ipcSummary.textContent = '暂无 IPC subclass 数据';
        const empty = createSvg('text', {{
          class: 'trend-empty',
          x: 360,
          y: 128,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        }});
        empty.textContent = '暂无 IPC subclass 数据';
        ipcSvg.appendChild(empty);
        return;
      }}

      const left = 54;
      const right = 690;
      const top = 26;
      const bottom = 198;
      const width = right - left;
      const height = bottom - top;
      const yMax = niceTrendMax(Math.max(...years.map(row => Number(row.total || 0))));
      const midTick = yMax <= 2 ? 1 : Math.round(yMax / 2);
      const yTicks = [...new Set([0, midTick, yMax])].sort((a, b) => a - b);
      const barWidth = Math.max(7, Math.min(24, width / Math.max(years.length, 1) * 0.62));
      ipcSummary.textContent = `${{years[0].year}}-${{years[years.length - 1].year}} 合计 ${{formatCount(totalAll)}} 个 subclass 记录`;

      yTicks.forEach(tick => {{
        const y = trendY(tick, yMax, top, height);
        ipcSvg.appendChild(createSvg('line', {{ class: 'trend-grid', x1: left, y1: y, x2: right, y2: y }}));
        const label = createSvg('text', {{ class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' }});
        label.textContent = formatCount(tick);
        ipcSvg.appendChild(label);
      }});

      ipcSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }}));
      ipcSvg.appendChild(createSvg('line', {{ class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }}));

      years.forEach((row, index) => {{
        const x = trendX(index, years.length, left, width);
        let baseY = bottom;
        const segments = Array.isArray(row.segments) ? row.segments : [];
        segments.forEach((segment, segmentIndex) => {{
          const count = Math.max(0, Number(segment.count || 0));
          if (!count) return;
          const nextY = trendY(count + (bottom - baseY) / height * yMax, yMax, top, height);
          const rect = createSvg('rect', {{
            class: 'ipc-segment',
            x: x - barWidth / 2,
            y: nextY,
            width: barWidth,
            height: Math.max(0, baseY - nextY),
            fill: ipcColors[segmentIndex % ipcColors.length]
          }});
          const title = createSvg('title');
          title.textContent = `${{row.year}} ${{segment.code}}：${{formatCount(count)}}`;
          rect.appendChild(title);
          ipcSvg.appendChild(rect);
          baseY = nextY;
        }});

        if (years.length <= 12 || index % 2 === 0 || index === years.length - 1) {{
          const xLabel = createSvg('text', {{
            class: 'trend-label',
            x,
            y: bottom + 22,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          }});
          xLabel.textContent = String(row.year);
          ipcSvg.appendChild(xLabel);
        }}
      }});

      ipcLegend.innerHTML = codes.map((code, index) => `
        <span class="legend-item"><span class="legend-swatch" style="background:${{ipcColors[index % ipcColors.length]}}"></span>${{escapeHtml(code)}}</span>
      `).join('');
    }}

    function formatNumber(value, digits = 3) {{
      return Number.isFinite(value) ? value.toFixed(digits) : '';
    }}

    function shortText(value, limit = 170) {{
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
    }}

    function escapeHtml(value) {{
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }}

    function metricTooltip(metric) {{
      return `<div class="tip-title">${{escapeHtml(labels[metric])}} 前5</div>
        <div class="tip-muted">按 ${{escapeHtml(labels[metric])}} 排序；已排除 topic_id = -1。</div>`;
    }}

    function axisMetricTooltip(metric) {{
      const label = labels[metric] || metric;
      const explanation = axisExplanations[metric] || explanations[metric] || '';
      return `<div class="tip-title">${{escapeHtml(label)}}</div>
        <div>${{escapeHtml(explanation)}}</div>`;
    }}

    function topicTooltip(metric, item) {{
      return `<div class="tip-title">${{escapeHtml(labels[metric])}} | 主题 ${{item.topic_id}}</div>
        <div>得分：<strong>${{formatNumber(item.score)}}</strong> | 相对均值：<strong>${{formatNumber(item.relative, 2)}}</strong> | 排名：<strong>${{item.rank ?? ''}}</strong></div>
        <div class="tip-muted">主题规模=${{item.topic_size ?? '未知'}}</div>
        <div style="margin-top:6px;">${{escapeHtml(shortText(item.topic_keywords, 210))}}</div>`;
    }}

    function moveTip(event) {{
      if (!hoverTip.classList.contains('show')) return;
      const gap = 16;
      const width = hoverTip.offsetWidth || 320;
      const height = hoverTip.offsetHeight || 120;
      const left = Math.min(event.clientX + gap, window.innerWidth - width - gap);
      const top = Math.min(event.clientY + gap, window.innerHeight - height - gap);
      hoverTip.style.left = `${{Math.max(gap, left)}}px`;
      hoverTip.style.top = `${{Math.max(gap, top)}}px`;
    }}

    function showTip(event, htmlText) {{
      hoverTip.innerHTML = htmlText;
      hoverTip.classList.add('show');
      moveTip(event);
    }}

    function hideTip() {{
      hoverTip.classList.remove('show');
    }}

    function bestMetric(topic) {{
      let best = metrics[0];
      let bestValue = -Infinity;
      metrics.forEach(metric => {{
        const value = safeRelative(topic, metric);
        if (value > bestValue) {{
          bestValue = value;
          best = metric;
        }}
      }});
      return {{ metric: best, value: bestValue }};
    }}

    function listHtml(items) {{
      if (!Array.isArray(items) || !items.length) return '<li>暂无数据</li>';
      return items.slice(0, 6).map(item => `<li>${{escapeHtml(item)}}</li>`).join('');
    }}

    function statusText(status) {{
      if (!status) return '未生成';
      if (status.startsWith('missing_env:')) return `缺少环境变量 ${{status.split(':')[1] || ''}}`;
      if (status === 'error') return '生成失败';
      if (status === 'generated') return '已生成';
      if (status === 'not_generated') return '未生成';
      return status;
    }}

    function confidenceText(value) {{
      const map = {{ high: '高', medium: '中', low: '低', unknown: '未知' }};
      return map[value] || value || '未知';
    }}

    function updateInterpretation(topic) {{
      const panel = document.getElementById('routePanel');
      const info = interpretations[String(topic.topic_id)];
      if (!info || info.status !== 'generated') {{
        const status = info?.status || 'not_generated';
        const error = info?.error ? `<p>${{escapeHtml(info.error)}}</p>` : '';
        panel.innerHTML = `<h3>技术路线解读 <span class="route-status">${{escapeHtml(statusText(status))}}</span></h3>
          <p>该主题尚未通过 DeepSeek API 生成解释。设置 DEEPSEEK_API_KEY 后重新运行脚本即可生成。</p>${{error}}`;
        return;
      }}
      panel.innerHTML = `
        <h3>${{escapeHtml(info.route_name_cn || '技术路线解读')}} <span class="route-status">置信度：${{escapeHtml(confidenceText(info.confidence))}}</span></h3>
        <p>${{escapeHtml(info.meaning || '')}}</p>
        <div class="route-grid">
          <div class="route-block">
            <div class="route-label">技术路线</div>
            <ol class="route-list">${{listHtml(info.technology_route)}}</ol>
          </div>
          <div class="route-block">
            <div class="route-label">关键技术要素</div>
            <ul class="route-list">${{listHtml(info.key_components)}}</ul>
          </div>
          <div class="route-block">
            <div class="route-label">核聚变产业链关系与应用</div>
            <p><strong>产业链位置：</strong>${{escapeHtml(info.fusion_industry_chain_position || '关系尚不明确')}}</p>
            <p>${{escapeHtml(info.fusion_industry_chain_relation || '代表专利尚未提供足够证据判断具体关系。')}}</p>
            <ul class="route-list">${{listHtml(info.application_scenarios)}}</ul>
          </div>
        </div>
        <p><strong>信号说明：</strong>${{escapeHtml(info.signal_notes || '')}}</p>`;
    }}

    function updateTop1Labels(topic) {{
      metrics.forEach((metric, index) => {{
        const show = Boolean(topic.top1?.[metric]);
        top1Labels[index].classList.toggle('show', show);
        pointNodes[index].classList.toggle('top1', show);
      }});
    }}

    function updateDetails(topic) {{
      document.getElementById('topicTitle').textContent = `主题 ${{topic.topic_id}}`;
      document.getElementById('topicSize').textContent = `主题规模=${{topic.topic_size ?? '未知'}}`;
      document.getElementById('outlierFlag').textContent = topic.is_bertopic_outlier ? 'BERTopic 离群主题' : '聚类主题';
      const best = bestMetric(topic);
      document.getElementById('maxMetric').textContent = `${{labels[best.metric]}} 相对均值=${{formatNumber(best.value, 2)}}`;
      document.getElementById('topicKeywords').textContent = shortText(topic.topic_keywords, 260);
      updateInterpretation(topic);
    }}

    function setActive(topicId) {{
      document.querySelectorAll('.topic-button').forEach(button => {{
        button.classList.toggle('active', Number(button.dataset.topicId) === topicId);
      }});
    }}

    function selectTopic(topicId) {{
      const topic = topics.get(Number(topicId));
      if (!topic) return;
      setActive(topic.topic_id);
      updateDetails(topic);
      animateRadar(topic);
      renderPatentTrend(topic);
      renderGrowthTrend(topic);
      renderIpcDistribution(topic);
      currentTopic = topic;
    }}

    function renderTopLists() {{
      const container = document.getElementById('topList');
      container.innerHTML = metrics.map(metric => {{
        const explanation = explanations[metric] || '';
        const items = payload.top5[metric].map(item => `
          <button class="topic-button" type="button" data-topic-id="${{item.topic_id}}" data-metric="${{metric}}">
            <div class="topic-row">
              <span class="topic-id">主题 ${{item.topic_id}}</span>
              <span class="score">${{formatNumber(item.score)}} / 相对 ${{formatNumber(item.relative, 2)}}</span>
            </div>
            <div class="topic-key">${{escapeHtml(shortText(item.topic_keywords, 110))}}</div>
          </button>
        `).join('');
        return `<section class="metric-group">
          <div class="metric-title" data-metric="${{metric}}"><span>${{escapeHtml(labels[metric])}}</span><span>前5</span></div>
          <div class="metric-explanation"><span class="metric-explanation-label">${{escapeHtml(explanation)}}</div>
          ${{items}}
        </section>`;
      }}).join('');

      container.querySelectorAll('.topic-button').forEach(button => {{
        button.addEventListener('click', () => selectTopic(button.dataset.topicId));
        button.addEventListener('mouseenter', event => {{
          const metric = button.dataset.metric;
          const topicId = Number(button.dataset.topicId);
          const item = (payload.top5[metric] || []).find(candidate => candidate.topic_id === topicId);
          if (item) showTip(event, topicTooltip(metric, item));
        }});
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      }});
      container.querySelectorAll('.metric-title').forEach(title => {{
        title.addEventListener('mouseenter', event => showTip(event, metricTooltip(title.dataset.metric)));
        title.addEventListener('mousemove', moveTip);
        title.addEventListener('mouseleave', hideTip);
      }});
    }}

    function metricScore(topic, metric) {{
      const value = topic?.scores?.[metric];
      return Number.isFinite(value) ? value : -Infinity;
    }}

    function sorterCompositeScore(topic) {{
      if (!selectedSortMetrics.length) return 0;
      return selectedSortMetrics.reduce((total, metric, index) => {{
        const value = metricScore(topic, metric);
        const normalized = Number.isFinite(value) ? value : 0;
        return total + normalized * Math.pow(2, selectedSortMetrics.length - index - 1);
      }}, 0);
    }}

    function sorterStatusText() {{
      if (!selectedSortMetrics.length) return '点击指标开始排序';
      return '排序条件（先点优先）：' + selectedSortMetrics
        .map((metric, index) => `${{index + 1}}.${{labels[metric] || metric}}`)
        .join(' → ');
    }}

    function sorterBreakdown(topic) {{
      if (!selectedSortMetrics.length) return '';
      return selectedSortMetrics
        .map(metric => `${{escapeHtml(labels[metric] || metric)}}=${{formatNumber(metricScore(topic, metric))}}`)
        .join(' · ');
    }}

    function summarizedTopicName(topic) {{
      const name = String(topic?.route_name_cn || '').trim();
      if (name) return name;
      const summary = String(topic?.topic_summary || topic?.topic_keywords || '').trim();
      return summary || `主题 ${{topic?.topic_id ?? ''}}`;
    }}

    function sortedTopicsForSorter() {{
      if (!selectedSortMetrics.length) return [];
      return [...topics.values()].sort((left, right) => {{
        const compositeDiff = sorterCompositeScore(right) - sorterCompositeScore(left);
        if (Math.abs(compositeDiff) > 1e-12) return compositeDiff;
        for (let index = 0; index < selectedSortMetrics.length; index += 1) {{
          const metric = selectedSortMetrics[index];
          const diff = metricScore(right, metric) - metricScore(left, metric);
          if (Math.abs(diff) > 1e-12) return diff;
        }}
        return left.topic_id - right.topic_id;
      }});
    }}

    function sorterTopicTooltip(topic) {{
      const lines = selectedSortMetrics.map(metric => `
        <div>${{escapeHtml(labels[metric] || metric)}}：<strong>${{formatNumber(metricScore(topic, metric))}}</strong>
          | 相对均值：<strong>${{formatNumber(topic.relative?.[metric], 2)}}</strong>
          | 排名：<strong>${{topic.rank?.[metric] ?? ''}}</strong></div>
      `).join('');
      return `<div class="tip-title">排序结果 | 主题 ${{topic.topic_id}}</div>
        <div>综合排序分：<strong>${{formatNumber(sorterCompositeScore(topic))}}</strong></div>
        ${{lines}}
        <div class="tip-muted">主题规模=${{topic.topic_size ?? '未知'}}</div>
        <div style="margin-top:6px;">${{escapeHtml(shortText(topic.topic_keywords, 210))}}</div>`;
    }}

    function renderSorter() {{
      const container = document.getElementById('topList');
      const controls = metrics.map(metric => {{
        const orderIndex = selectedSortMetrics.indexOf(metric);
        const activeClass = orderIndex >= 0 ? ' active' : '';
        const orderText = orderIndex >= 0 ? String(orderIndex + 1) : '+';
        const explanation = explanations[metric] || '';
        return `<button class="sorter-button${{activeClass}}" type="button" data-metric="${{metric}}">
          <div class="sorter-button-head">
            <span>${{escapeHtml(labels[metric] || metric)}}</span>
            <span class="sorter-order">${{escapeHtml(orderText)}}</span>
          </div>
          <div class="sorter-note">${{escapeHtml(explanation)}}</div>
        </button>`;
      }}).join('');

      const resultTopics = sortedTopicsForSorter().slice(0, resultLimit);
      const directionSummary = selectedSortMetrics.length === 1
        ? singleMetricDirectionSummaries[selectedSortMetrics[0]]
        : null;
      const results = selectedSortMetrics.length
        ? resultTopics.map((topic, index) => `
          <button class="topic-button" type="button" data-topic-id="${{topic.topic_id}}">
            <div class="topic-row">
              <span class="topic-id" title="${{escapeHtml(summarizedTopicName(topic))}}">${{index + 1}}. ${{escapeHtml(shortText(summarizedTopicName(topic), 28))}}</span>
              <span class="score">综合 ${{formatNumber(sorterCompositeScore(topic))}}</span>
            </div>
            <div class="sorter-breakdown">${{sorterBreakdown(topic)}}</div>
            <div class="topic-key">${{escapeHtml(shortText(topic.topic_keywords, 110))}}</div>
          </button>
        `).join('')
        : '<div class="sorter-empty">点击上方指标后显示排序结果；先点击的指标权重更高。</div>';

      container.innerHTML = `<section class="metric-group sorter-panel">
          <div class="sorter-controls">${{controls}}</div>
          <div class="sorter-status">
            <span>${{escapeHtml(sorterStatusText())}}</span>
            <button class="sorter-reset" type="button">重置</button>
          </div>
        </section>
        <section class="sorter-results">
          <div class="sorter-results-title"><span>排序结果</span><span>Top ${{resultLimit}}</span></div>
          ${{directionSummary ? `<div class="sorter-direction-summary">
            <div>${{escapeHtml(directionSummary.technology)}}</div>
            <div>${{escapeHtml(directionSummary.industry)}}</div>
          </div>` : ''}}
          ${{results}}
        </section>`;

      container.querySelectorAll('.sorter-button').forEach(button => {{
        button.addEventListener('click', () => {{
          const metric = button.dataset.metric;
          const selectedIndex = selectedSortMetrics.indexOf(metric);
          if (selectedIndex >= 0) {{
            selectedSortMetrics.splice(selectedIndex, 1);
          }} else {{
            selectedSortMetrics.push(metric);
          }}
          renderSorter();
          setActive(currentTopic.topic_id);
        }});
        button.addEventListener('mouseenter', event => showTip(event, axisMetricTooltip(button.dataset.metric)));
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      }});

      const reset = container.querySelector('.sorter-reset');
      reset.addEventListener('click', () => {{
        selectedSortMetrics = [];
        renderSorter();
        setActive(currentTopic.topic_id);
      }});

      container.querySelectorAll('.topic-button').forEach(button => {{
        button.addEventListener('click', () => selectTopic(button.dataset.topicId));
        button.addEventListener('mouseenter', event => {{
          const topic = topics.get(Number(button.dataset.topicId));
          if (topic) showTip(event, sorterTopicTooltip(topic));
        }});
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      }});
    }}

    drawBase();
    renderSorter();
    updateDetails(currentTopic);
    renderPatentTrend(currentTopic);
    renderGrowthTrend(currentTopic);
    renderIpcDistribution(currentTopic);
    updateTop1Labels(currentTopic);
    setActive(currentTopic.topic_id);
  </script>
</body>
</html>
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_doc, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate an interactive topic radar dashboard.")
    parser.add_argument("--input", type=Path, default=DEFAULT_TOPIC_WORKBOOK)
    parser.add_argument("--output", type=Path, default=DEFAULT_DASHBOARD_HTML)
    parser.add_argument("--topn", type=int, default=5)
    parser.add_argument("--initial_topic", type=int, default=None)
    parser.add_argument(
        "--interpret",
        action=argparse.BooleanOptionalAction,
        default=True,
        help=(
            "Allow DeepSeek generation for missing topic interpretations and single-metric Top 10 direction "
            "summaries; --no-interpret only loads existing cached results."
        ),
    )
    parser.add_argument("--deepseek_model", default="deepseek-v4-flash")
    parser.add_argument("--deepseek_base_url", default="https://api.deepseek.com")
    parser.add_argument("--deepseek_api_key_env", default="DEEPSEEK_API_KEY")
    parser.add_argument(
        "--interpret_cache",
        type=Path,
        default=DEFAULT_INTERPRET_CACHE,
    )
    parser.add_argument(
        "--direction_summary_cache",
        type=Path,
        default=DEFAULT_DIRECTION_SUMMARY_CACHE,
    )
    parser.add_argument("--refresh_interpretations", action="store_true")
    parser.add_argument("--refresh_direction_summaries", action="store_true")
    parser.add_argument("--interpret_timeout", type=int, default=120)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = data_path(args.input)
    output_path = data_path(args.output)
    interpret_cache_path = data_path(args.interpret_cache)
    direction_summary_cache_path = data_path(args.direction_summary_cache)

    df = load_topic_scores(input_path)
    period_counts = load_topic_period_counts(input_path)
    visible_topic_ids = (
        pd.to_numeric(df["topic_id"], errors="coerce")
        .dropna()
        .astype(int)
    )
    visible_topic_ids = sorted(topic_id for topic_id in visible_topic_ids.unique().tolist() if topic_id != -1)
    ipc_year_distribution = load_topic_ipc_year_distribution(input_path, visible_topic_ids)
    payload = build_dashboard_payload(
        df=df,
        topn=args.topn,
        initial_topic_id=args.initial_topic,
        period_counts=period_counts,
        ipc_year_distribution=ipc_year_distribution,
    )
    payload["interpretations"] = workbook_interpretations(payload)
    payload["singleMetricDirectionSummaries"] = ensure_single_metric_direction_summaries(
        payload=payload,
        cache_path=direction_summary_cache_path,
        api_key_env=args.deepseek_api_key_env,
        model=args.deepseek_model,
        base_url=args.deepseek_base_url,
        timeout=args.interpret_timeout,
        refresh=args.refresh_direction_summaries,
        allow_generate=args.interpret,
    )
    if args.interpret:
        missing_interpret_ids = [
            topic_id
            for topic_id in payload["interpretTopicIds"]
            if str(topic_id) not in payload["interpretations"]
        ]
        if missing_interpret_ids:
            fallback_payload = {**payload, "interpretTopicIds": missing_interpret_ids}
            payload["interpretations"].update(
                ensure_topic_interpretations(
                    payload=interpretation_payload(fallback_payload),
                    cache_path=interpret_cache_path,
                    api_key_env=args.deepseek_api_key_env,
                    model=args.deepseek_model,
                    base_url=args.deepseek_base_url,
                    refresh=args.refresh_interpretations,
                    timeout=args.interpret_timeout,
                )
            )
    write_dashboard_html(payload=payload, output_path=output_path, input_label=str(input_path))
    print(f"交互面板：{output_path.resolve()}")
    print(f"主题数：{len(payload['topics'])}；每个指标前 N：{args.topn}")
    if args.interpret:
        print(f"解读主题数：{len(payload['interpretTopicIds'])}")
        print(f"解读缓存：{interpret_cache_path.resolve()}")
    print(f"单指标方向总结数：{len(payload['singleMetricDirectionSummaries'])}")
    print(f"单指标方向总结缓存：{direction_summary_cache_path.resolve()}")


if __name__ == "__main__":
    main()
