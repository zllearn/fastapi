from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any

from src.deepseek_topic_interpreter import call_deepseek_chat
from src.visualization import METRIC_LABELS, METRICS


DIRECTION_SUMMARY_SCHEMA_VERSION = 1
DIRECTION_CONTENT_MAX_CHARS = 27


def _clean_text(value: object) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _load_cache(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}
    return {str(key): value for key, value in payload.items() if isinstance(value, dict)}


def _save_cache(path: Path, cache: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _metric_top_topics(payload: dict[str, Any], metric: str, limit: int = 10) -> list[dict[str, Any]]:
    topics = payload.get("topics", [])

    def score(topic: dict[str, Any]) -> float:
        value = topic.get("scores", {}).get(metric)
        return float(value) if value is not None else float("-inf")

    ranked = sorted(
        topics,
        key=lambda topic: (
            topic.get("scores", {}).get(metric) is not None,
            score(topic),
            -int(topic.get("topic_id", 0)),
        ),
        reverse=True,
    )[:limit]
    return [
        {
            "rank": index,
            "topic_id": int(topic.get("topic_id", 0)),
            "score": topic.get("scores", {}).get(metric),
            "route_name_cn": _clean_text(topic.get("route_name_cn")),
            "topic_summary": _clean_text(topic.get("topic_summary") or topic.get("topic_keywords")),
            "fusion_industry_chain_position": _clean_text(topic.get("fusion_industry_chain_position")),
            "fusion_industry_chain_relation": _clean_text(topic.get("fusion_industry_chain_relation")),
            "fusion_application_scenarios": _clean_text(topic.get("fusion_application_scenarios")),
        }
        for index, topic in enumerate(ranked, start=1)
    ]


def _signature(metric: str, model: str, topics: list[dict[str, Any]]) -> str:
    encoded = json.dumps(
        {
            "schema_version": DIRECTION_SUMMARY_SCHEMA_VERSION,
            "metric": metric,
            "model": model,
            "topics": topics,
        },
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha1(encoded).hexdigest()[:16]


def _build_prompt(metric: str, topics: list[dict[str, Any]]) -> str:
    metric_label = METRIC_LABELS.get(metric, metric)
    return (
        "请分析下面按单一指标排序的核聚变专利主题 Top 10，概括其中占主导的技术方向和产业方向。"
        "必须综合 Top 10，而不是只复述第一名；不要计算新分数，不要讨论其他指标或指标组合。\n\n"
        "只返回 JSON 对象：\n"
        "{\n"
        '  "technology_direction": "技术方向概括，不带‘技术：’前缀，不超过27个汉字",\n'
        '  "industry_direction": "核聚变产业链环节及应用方向概括，不带‘产业：’前缀，不超过27个汉字"\n'
        "}\n\n"
        "要求：\n"
        "1. 技术方向应归纳共同或占主导的技术簇，不要简单罗列十个主题名称。\n"
        "2. 产业方向应说明上游材料与部件、中游装置与系统、下游运行应用或跨环节支撑中的主导方向。\n"
        "3. 只能依据给出的主题总结和产业链证据，不得编造。证据分散时，应概括为多元技术或跨环节支撑。\n"
        "4. 两个字段各自最多27个汉字，以保证加上界面前缀后每行不超过30字。\n\n"
        f"排序指标：{metric_label}（{metric}）\n"
        f"Top 10主题：\n{json.dumps(topics, ensure_ascii=False, indent=2)}"
    )


def _normalize_direction(value: object, prefix: str) -> str:
    text = _clean_text(value)
    text = re.sub(rf"^{re.escape(prefix)}\s*[：:]\s*", "", text)
    clipped = "".join(list(text)[:DIRECTION_CONTENT_MAX_CHARS]).rstrip("、，；： ")
    for opener, closer in [("（", "）"), ("(", ")"), ("【", "】")]:
        if clipped.count(opener) > clipped.count(closer):
            clipped = clipped.rsplit(opener, 1)[0].rstrip("、，；： ")
    return clipped


def ensure_single_metric_direction_summaries(
    payload: dict[str, Any],
    cache_path: str | Path,
    api_key_env: str = "DEEPSEEK_API_KEY",
    model: str = "deepseek-v4-flash",
    base_url: str = "https://api.deepseek.com",
    timeout: int = 120,
    refresh: bool = False,
    allow_generate: bool = True,
    retries: int = 2,
) -> dict[str, dict[str, Any]]:
    cache_path = Path(cache_path)
    cache = _load_cache(cache_path)
    api_key = os.environ.get(api_key_env, "").strip()
    summaries: dict[str, dict[str, Any]] = {}

    for metric in METRICS:
        topics = _metric_top_topics(payload, metric, limit=10)
        signature = _signature(metric, model, topics)
        cached = cache.get(metric, {})
        if (
            not refresh
            and cached.get("status") == "generated"
            and cached.get("signature") == signature
            and cached.get("schema_version") == DIRECTION_SUMMARY_SCHEMA_VERSION
        ):
            summaries[metric] = cached | {
                "technology": f"技术：{_normalize_direction(cached.get('technology'), '技术')}",
                "industry": f"产业：{_normalize_direction(cached.get('industry'), '产业')}",
            }
            continue
        if not allow_generate or not api_key:
            continue

        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                result = call_deepseek_chat(
                    prompt=_build_prompt(metric, topics),
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    timeout=timeout,
                    system_prompt=(
                        "你是核聚变专利组合与产业链分析专家。必须基于输入证据做简洁归纳，"
                        "只输出有效 JSON，不要输出 Markdown。"
                    ),
                    max_tokens=1200,
                )
                technology = _normalize_direction(result.get("technology_direction"), "技术")
                industry = _normalize_direction(result.get("industry_direction"), "产业")
                if not technology or not industry:
                    raise RuntimeError("DeepSeek direction summary is missing required fields.")
                entry = {
                    "schema_version": DIRECTION_SUMMARY_SCHEMA_VERSION,
                    "signature": signature,
                    "metric": metric,
                    "technology": f"技术：{technology}",
                    "industry": f"产业：{industry}",
                    "status": "generated",
                    "model": model,
                    "generated_at": int(time.time()),
                    "topic_ids": [topic["topic_id"] for topic in topics],
                }
                cache[metric] = entry
                summaries[metric] = entry
                _save_cache(cache_path, cache)
                print(f"DeepSeek direction summary {metric}: generated from single-metric Top 10.")
                break
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(min(2.0 * (attempt + 1), 5.0))
        else:
            print(f"DeepSeek direction summary {metric} failed: {last_error}")

    return summaries
