from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


INTERPRETATION_SCHEMA_VERSION = 2


DEFAULT_INTERPRETATION = {
    "schema_version": INTERPRETATION_SCHEMA_VERSION,
    "route_name_cn": "",
    "route_name_en": "",
    "meaning": "",
    "technology_route": [],
    "key_components": [],
    "fusion_industry_chain_position": "",
    "fusion_industry_chain_relation": "",
    "application_scenarios": [],
    "signal_notes": "",
    "confidence": "unknown",
    "keyword_evidence": [],
    "status": "not_generated",
}


def load_interpretation_cache(path: str | Path) -> dict[str, dict[str, Any]]:
    cache_path = Path(path)
    if not cache_path.exists():
        return {}
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): value for key, value in data.items() if isinstance(value, dict)}


def save_interpretation_cache(path: str | Path, cache: dict[str, dict[str, Any]]) -> None:
    cache_path = Path(path)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def selected_topic_ids_from_payload(payload: dict[str, Any]) -> list[int]:
    topic_ids: set[int] = set()
    for items in payload.get("top5", {}).values():
        for item in items:
            topic_id = int(item["topic_id"])
            if topic_id != -1:
                topic_ids.add(topic_id)
    return sorted(topic_ids)


def _topic_lookup(payload: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(topic["topic_id"]): topic for topic in payload.get("topics", [])}


def _top_metrics(topic: dict[str, Any], limit: int = 3) -> list[dict[str, Any]]:
    rows = []
    for metric, value in topic.get("scores", {}).items():
        if value is None:
            continue
        rows.append(
            {
                "metric": metric,
                "score": value,
                "relative": topic.get("relative", {}).get(metric),
                "rank": topic.get("rank", {}).get(metric),
            }
        )
    rows.sort(key=lambda row: (row.get("score") is not None, row.get("score") or -1), reverse=True)
    return rows[:limit]


def build_topic_prompt(topic: dict[str, Any]) -> str:
    topic_payload = {
        "topic_id": topic.get("topic_id"),
        "topic_size": topic.get("topic_size"),
        "topic_summary_or_evidence": topic.get("topic_keywords"),
        "top_metrics": _top_metrics(topic),
        "all_scores": topic.get("scores", {}),
        "relative_to_average": topic.get("relative", {}),
        "metric_rank": topic.get("rank", {}),
    }
    return (
        "请基于下面的聚类主题句、主题证据和指标，将该 topic 归纳为一条核聚变相关的"
        "技术路线。不要计算综合得分，不要做筛选，不要夸大主题含义。若主题证据不足，"
        "请在 signal_notes 中说明不确定性。\n\n"
        "必须只返回 JSON 对象，字段如下：\n"
        "{\n"
        '  "route_name_cn": "中文技术路线名称",\n'
        '  "route_name_en": "English technology route name",\n'
        '  "meaning": "2-3 句解释该 topic 代表什么技术方向",\n'
        '  "technology_route": ["从材料/部件/装置/控制到应用的路线步骤，3-5 条"],\n'
        '  "key_components": ["关键技术要素，3-8 个"],\n'
        '  "fusion_industry_chain_position": "上游材料与部件、中游装置与系统、下游运行与应用或跨环节支撑，可写多个环节",\n'
        '  "fusion_industry_chain_relation": "1-3 句说明该技术如何进入核聚变产业链、服务哪些聚变系统或解决什么工程问题",\n'
        '  "application_scenarios": ["在核聚变装置、部件、建设、运行或维护中的具体应用，2-5 个"],\n'
        '  "signal_notes": "结合指标解释该路线为什么值得关注，以及不确定性",\n'
        '  "confidence": "high|medium|low",\n'
        '  "keyword_evidence": ["支撑判断的证据短句或关键技术表述，3-8 个"]\n'
        "}\n\n"
        "产业链关系和应用必须以主题证据为依据；通用技术要说明可能服务的聚变系统及成立条件，"
        "证据不足时直接说明关系尚不明确，不得编造。\n\n"
        f"主题数据：\n{json.dumps(topic_payload, ensure_ascii=False, indent=2)}"
    )


def call_deepseek_chat(
    prompt: str,
    api_key: str,
    model: str = "deepseek-v4-flash",
    base_url: str = "https://api.deepseek.com",
    timeout: int = 120,
    system_prompt: str | None = None,
    max_tokens: int = 1200,
) -> dict[str, Any]:
    url = base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt or (
                    "你是核聚变专利与技术路线分析专家。你的任务是把 topic 关键词解释成"
                    "可读的技术路线。必须输出有效 JSON，不要输出 Markdown。"
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        url=url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"DeepSeek API HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"DeepSeek API connection failed: {exc}") from exc

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    parsed["schema_version"] = INTERPRETATION_SCHEMA_VERSION
    parsed["status"] = "generated"
    parsed["model"] = model
    parsed["generated_at"] = int(time.time())
    return parsed


def ensure_topic_interpretations(
    payload: dict[str, Any],
    cache_path: str | Path,
    api_key_env: str = "DEEPSEEK_API_KEY",
    model: str = "deepseek-v4-flash",
    base_url: str = "https://api.deepseek.com",
    refresh: bool = False,
    timeout: int = 120,
) -> dict[str, dict[str, Any]]:
    """Generate or load route interpretations for the filtered dashboard topics."""
    cache = load_interpretation_cache(cache_path)
    api_key = os.environ.get(api_key_env, "").strip()
    topic_lookup = _topic_lookup(payload)
    target_ids = selected_topic_ids_from_payload(payload)

    if not api_key:
        for topic_id in target_ids:
            cache.setdefault(str(topic_id), DEFAULT_INTERPRETATION | {"status": f"missing_env:{api_key_env}"})
        save_interpretation_cache(cache_path, cache)
        return {str(topic_id): cache[str(topic_id)] for topic_id in target_ids}

    for topic_id in target_ids:
        key = str(topic_id)
        if (
            not refresh
            and key in cache
            and cache[key].get("status") == "generated"
            and cache[key].get("schema_version") == INTERPRETATION_SCHEMA_VERSION
        ):
            continue
        topic = topic_lookup.get(topic_id)
        if not topic:
            continue
        try:
            cache[key] = call_deepseek_chat(
                prompt=build_topic_prompt(topic),
                api_key=api_key,
                model=model,
                base_url=base_url,
                timeout=timeout,
            )
            print(f"Interpreted topic {topic_id} with {model}")
        except Exception as exc:
            cache[key] = DEFAULT_INTERPRETATION | {
                "status": "error",
                "error": str(exc),
                "model": model,
            }
            print(f"Failed to interpret topic {topic_id}: {exc}")
        save_interpretation_cache(cache_path, cache)

    return {str(topic_id): cache.get(str(topic_id), DEFAULT_INTERPRETATION) for topic_id in target_ids}
