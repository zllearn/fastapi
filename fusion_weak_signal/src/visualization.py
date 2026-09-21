from __future__ import annotations

import math
import html
import warnings
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


METRICS = [
    "impact_score",
    "novelty_score",
    "short_trend_score",
    "long_trend_score",
    "centrality_score",
    "cross_domain_score",
    "lof_score",
]

METRIC_LABELS = {
    "impact_score": "影响力",
    "novelty_score": "新颖性",
    "short_trend_score": "短期趋势",
    "long_trend_score": "长期趋势",
    "centrality_score": "接近中心性",
    "cross_domain_score": "跨领域性",
    "lof_score": "离群因子",
}


def load_topic_scores(path: str) -> pd.DataFrame:
    """Read a topic normalized-indicator table from CSV or Excel."""
    input_path = Path(path)
    if not input_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {input_path}")

    if input_path.suffix.lower() in {".xlsx", ".xls"}:
        xls = pd.ExcelFile(input_path)
        preferred_sheets = [
            "06_topic_indicator_normalized",
            "06_indicator_norm",
            "topic_indicator_normalized",
            "topic_indicator_norm",
        ]
        sheet = next((name for name in preferred_sheets if name in xls.sheet_names), xls.sheet_names[0])
        df = pd.read_excel(input_path, sheet_name=sheet)
    else:
        df = pd.read_csv(input_path, encoding="utf-8-sig")

    required = ["topic_id", *METRICS]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Input table is missing required columns: {', '.join(missing)}")

    out = df.copy()
    out["topic_id"] = pd.to_numeric(out["topic_id"], errors="coerce")
    if out["topic_id"].isna().any():
        raise ValueError("Column topic_id contains non-numeric values.")
    out["topic_id"] = out["topic_id"].astype(int)

    for col in METRICS:
        out[col] = pd.to_numeric(out[col], errors="coerce")
        if out[col].isna().all():
            warnings.warn(f"Metric {col} is all NaN; related radar values will be NaN.")

    if "topic_keywords" not in out.columns:
        warnings.warn("Column topic_keywords is missing; chart titles will omit keywords.")
        out["topic_keywords"] = ""
    if "topic_size" not in out.columns:
        warnings.warn("Column topic_size is missing; chart titles will show topic_size as unknown.")
        out["topic_size"] = np.nan
    if "is_bertopic_outlier" not in out.columns:
        warnings.warn("Column is_bertopic_outlier is missing; assuming False.")
        out["is_bertopic_outlier"] = False
    return out


def compute_radar_values(
    df: pd.DataFrame,
    topic_id,
    metrics: list[str] | None = None,
) -> pd.DataFrame:
    """
    Compute radar data for one topic.

    Output columns:
    topic_id, metric, metric_label, score, avg_score, radar_value, rank, is_top1
    """
    metrics = metrics or METRICS
    topic_id = int(topic_id)
    missing = [col for col in ["topic_id", *metrics] if col not in df.columns]
    if missing:
        raise ValueError(f"Input table is missing required columns: {', '.join(missing)}")

    row = df.loc[df["topic_id"].astype(int).eq(topic_id)]
    if row.empty:
        raise ValueError(f"topic_id {topic_id} does not exist in the input table.")
    row = row.iloc[0]

    records = []
    for metric in metrics:
        metric_values = pd.to_numeric(df[metric], errors="coerce")
        score = pd.to_numeric(pd.Series([row[metric]]), errors="coerce").iloc[0]
        avg_score = metric_values.mean(skipna=True)
        ranks = metric_values.rank(method="min", ascending=False, na_option="bottom")
        rank = ranks.loc[row.name]
        if pd.isna(avg_score) or avg_score == 0 or pd.isna(score):
            radar_value = np.nan
            if pd.isna(avg_score):
                warnings.warn(f"Metric {metric} has NaN average; radar value is set to NaN.")
            elif avg_score == 0:
                warnings.warn(f"Metric {metric} average is zero; radar value is set to NaN.")
        else:
            radar_value = float(score) / float(avg_score)

        records.append(
            {
                "topic_id": topic_id,
                "metric": metric,
                "metric_label": METRIC_LABELS.get(metric, metric),
                "score": score,
                "avg_score": avg_score,
                "radar_value": radar_value,
                "rank": int(rank) if pd.notna(rank) else np.nan,
                "is_top1": bool(pd.notna(rank) and int(rank) == 1),
            }
        )
    return pd.DataFrame(records)


def topic_meta_from_df(df: pd.DataFrame, topic_id) -> dict:
    topic_id = int(topic_id)
    row = df.loc[df["topic_id"].astype(int).eq(topic_id)]
    if row.empty:
        raise ValueError(f"topic_id {topic_id} does not exist in the input table.")
    row = row.iloc[0]
    return {
        "topic_id": topic_id,
        "topic_size": row.get("topic_size", np.nan),
        "topic_keywords": str(row.get("topic_keywords", "")),
        "is_bertopic_outlier": row.get("is_bertopic_outlier", False),
    }


def _prepare_matplotlib():
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    return plt


def _closed(values: Iterable[float]) -> list[float]:
    items = list(values)
    return items + items[:1]


def _angles(n: int) -> list[float]:
    values = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    return values + values[:1]


def _short_keywords(value: str, max_len: int = 120) -> str:
    value = " ".join(str(value).split())
    if len(value) <= max_len:
        return value
    return value[: max_len - 3] + "..."


def _title(topic_meta: dict, prefix: str) -> str:
    keywords = _short_keywords(topic_meta.get("topic_keywords", ""))
    size = topic_meta.get("topic_size", "unknown")
    topic_id = topic_meta.get("topic_id", "")
    if pd.isna(size):
        size = "未知"
    title = f"{prefix}\n主题 {topic_id} | 规模={size}"
    if keywords:
        title += f" | {keywords}"
    return title


def _save(fig, output_png: str, output_svg: str) -> None:
    Path(output_png).parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_png, dpi=300, bbox_inches="tight", facecolor="white")
    fig.savefig(output_svg, bbox_inches="tight", facecolor="white")


def plot_relative_avg_radar(
    radar_df: pd.DataFrame,
    topic_meta: dict,
    output_png: str,
    output_svg: str,
) -> None:
    """
    Draw a relative-to-average radar chart.

    The gray dashed reference ring is fixed at 1.0.
    """
    plt = _prepare_matplotlib()
    labels = radar_df["metric_label"].tolist()
    values = pd.to_numeric(radar_df["radar_value"], errors="coerce").to_numpy(dtype=float)
    finite_values = values[np.isfinite(values)]
    max_value = float(np.max(finite_values)) if len(finite_values) else 1.0
    r_max = min(3.0, max(1.5, math.ceil(max_value * 2.0) / 2.0))
    plot_values = np.nan_to_num(values, nan=0.0, posinf=r_max, neginf=0.0)
    plot_values = np.clip(plot_values, 0.0, r_max)

    angles = _angles(len(labels))
    fig, ax = plt.subplots(figsize=(7.5, 7.5), subplot_kw={"projection": "polar"})
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)

    ax.plot(angles, _closed([1.0] * len(labels)), color="#8c8c8c", linewidth=1.5, linestyle="--")
    ax.plot(angles, _closed(plot_values), color="#0067B1", linewidth=2.5)
    ax.fill(angles, _closed(plot_values), color="#0067B1", alpha=0.22)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=10)
    ticks = [tick for tick in [0.5, 1.0, 1.5, 2.0, 2.5, 3.0] if tick <= r_max]
    tick_labels = ["1.0 均值" if tick == 1.0 else f"{tick:.1f}" for tick in ticks]
    ax.set_yticks(ticks)
    ax.set_yticklabels(tick_labels, fontsize=9)
    ax.set_ylim(0, r_max)
    ax.grid(color="#d7d7d7", linewidth=0.8)
    ax.set_title(_title(topic_meta, "相对平均值主题雷达图"), fontsize=12, pad=28)

    for angle, value, is_top1 in zip(angles[:-1], plot_values, radar_df["is_top1"].tolist()):
        if is_top1 and np.isfinite(value):
            ax.text(angle, min(r_max, max(value, 0.05) + 0.08), "第1", ha="center", va="center", fontsize=8, color="#B00020")

    _save(fig, output_png, output_svg)
    plt.close(fig)


def plot_normalized_radar(
    df: pd.DataFrame,
    topic_id,
    metrics: list[str] | None,
    output_png: str,
    output_svg: str,
) -> None:
    """Draw the original 0-1 normalized-score radar chart."""
    metrics = metrics or METRICS
    topic_id = int(topic_id)
    row = df.loc[df["topic_id"].astype(int).eq(topic_id)]
    if row.empty:
        raise ValueError(f"topic_id {topic_id} does not exist in the input table.")
    row = row.iloc[0]

    plt = _prepare_matplotlib()
    labels = [METRIC_LABELS.get(metric, metric) for metric in metrics]
    topic_values = pd.to_numeric(row[metrics], errors="coerce").to_numpy(dtype=float)
    avg_values = df[metrics].apply(pd.to_numeric, errors="coerce").mean(skipna=True).to_numpy(dtype=float)
    topic_plot = np.clip(np.nan_to_num(topic_values, nan=0.0), 0.0, 1.0)
    avg_plot = np.clip(np.nan_to_num(avg_values, nan=0.0), 0.0, 1.0)

    angles = _angles(len(labels))
    fig, ax = plt.subplots(figsize=(7.5, 7.5), subplot_kw={"projection": "polar"})
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)

    ax.plot(angles, _closed(avg_plot), color="#8c8c8c", linewidth=1.5, linestyle="--", label="全体均值")
    ax.plot(angles, _closed(topic_plot), color="#00866E", linewidth=2.5, label=f"主题 {topic_id}")
    ax.fill(angles, _closed(topic_plot), color="#00866E", alpha=0.20)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"], fontsize=9)
    ax.set_ylim(0, 1.0)
    ax.grid(color="#d7d7d7", linewidth=0.8)
    ax.legend(loc="upper right", bbox_to_anchor=(1.25, 1.12), frameon=False)
    ax.set_title(_title(topic_meta_from_df(df, topic_id), "归一化主题雷达图"), fontsize=12, pad=28)

    _save(fig, output_png, output_svg)
    plt.close(fig)


def _topic_file_id(topic_id) -> str:
    return str(int(topic_id)) if float(topic_id).is_integer() else str(topic_id)


def generate_radar_for_topics(
    df: pd.DataFrame,
    topic_ids: list,
    output_dir: str,
) -> None:
    """Generate relative-average and normalized radar charts for multiple topics."""
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for topic_id in topic_ids:
        topic_id = int(topic_id)
        topic_meta = topic_meta_from_df(df, topic_id)
        radar_df = compute_radar_values(df, topic_id, METRICS)
        topic_file_id = _topic_file_id(topic_id)

        relative_base = out_dir / f"08_topic_radar_relative_avg_topic_{topic_file_id}"
        normalized_base = out_dir / f"09_topic_radar_normalized_topic_{topic_file_id}"

        radar_df.to_csv(f"{relative_base}.csv", index=False, encoding="utf-8-sig")
        plot_relative_avg_radar(
            radar_df=radar_df,
            topic_meta=topic_meta,
            output_png=f"{relative_base}.png",
            output_svg=f"{relative_base}.svg",
        )
        plot_normalized_radar(
            df=df,
            topic_id=topic_id,
            metrics=METRICS,
            output_png=f"{normalized_base}.png",
            output_svg=f"{normalized_base}.svg",
        )


def _inline_svg(path: Path) -> str:
    if not path.exists():
        return f"<p class=\"missing\">缺少 SVG：{html.escape(str(path))}</p>"
    text = path.read_text(encoding="utf-8", errors="ignore")
    start = text.find("<svg")
    if start >= 0:
        text = text[start:]
    return text


def _fmt(value) -> str:
    if pd.isna(value):
        return ""
    if isinstance(value, (float, np.floating)):
        return f"{float(value):.4f}"
    return html.escape(str(value))


def _radar_table_html(radar_df: pd.DataFrame) -> str:
    rows = []
    for _, row in radar_df.iterrows():
        top1 = "第1" if bool(row.get("is_top1", False)) else ""
        rows.append(
            "<tr>"
            f"<td>{html.escape(str(row['metric_label']))}</td>"
            f"<td>{_fmt(row['score'])}</td>"
            f"<td>{_fmt(row['avg_score'])}</td>"
            f"<td>{_fmt(row['radar_value'])}</td>"
            f"<td>{_fmt(row['rank'])}</td>"
            f"<td>{top1}</td>"
            "</tr>"
        )
    return (
        "<table>"
        "<thead><tr><th>指标</th><th>得分</th><th>均值</th>"
        "<th>相对均值</th><th>排名</th><th>第1</th></tr></thead>"
        "<tbody>"
        + "\n".join(rows)
        + "</tbody></table>"
    )


def write_radar_html_report(
    df: pd.DataFrame,
    topic_ids: list,
    output_dir: str,
    html_path: str,
    input_label: str = "",
) -> None:
    """Generate charts and write a standalone HTML report with inline SVG."""
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    generate_radar_for_topics(df=df, topic_ids=topic_ids, output_dir=str(out_dir))

    cards = []
    for topic_id in topic_ids:
        topic_id = int(topic_id)
        meta = topic_meta_from_df(df, topic_id)
        topic_file_id = _topic_file_id(topic_id)
        relative_svg = out_dir / f"08_topic_radar_relative_avg_topic_{topic_file_id}.svg"
        normalized_svg = out_dir / f"09_topic_radar_normalized_topic_{topic_file_id}.svg"
        csv_path = out_dir / f"08_topic_radar_relative_avg_topic_{topic_file_id}.csv"
        radar_df = pd.read_csv(csv_path, encoding="utf-8-sig")
        keywords = html.escape(_short_keywords(meta.get("topic_keywords", ""), max_len=180))
        size = meta.get("topic_size", "unknown")
        if pd.isna(size):
            size = "未知"

        cards.append(
            f"""
            <section class="topic-card">
              <div class="topic-head">
                <h2>主题 {topic_id}</h2>
                <div class="meta">主题规模={html.escape(str(size))}</div>
                <p>{keywords}</p>
              </div>
              <div class="charts">
                <figure>
                  <figcaption>相对全体平均值</figcaption>
                  {_inline_svg(relative_svg)}
                </figure>
                <figure>
                  <figcaption>原始 0-1 归一化得分</figcaption>
                  {_inline_svg(normalized_svg)}
                </figure>
              </div>
              {_radar_table_html(radar_df)}
            </section>
            """
        )

    html_doc = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>主题雷达图报告</title>
  <style>
    :root {{
      color-scheme: light;
      font-family: Arial, "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
      background: #f6f7f9;
      color: #18202a;
    }}
    body {{
      margin: 0;
      background: #f6f7f9;
    }}
    header {{
      padding: 28px 36px 20px;
      background: #ffffff;
      border-bottom: 1px solid #dde2e8;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 26px;
      letter-spacing: 0;
    }}
    .subtitle {{
      margin: 0;
      color: #5c6673;
      line-height: 1.5;
    }}
    main {{
      padding: 24px 36px 48px;
      max-width: 1480px;
      margin: 0 auto;
    }}
    .topic-card {{
      background: #ffffff;
      border: 1px solid #dde2e8;
      border-radius: 8px;
      padding: 22px;
      margin-bottom: 24px;
    }}
    .topic-head h2 {{
      margin: 0;
      font-size: 22px;
    }}
    .topic-head .meta {{
      margin-top: 4px;
      color: #5c6673;
      font-size: 14px;
    }}
    .topic-head p {{
      margin: 8px 0 18px;
      color: #394453;
      line-height: 1.45;
    }}
    .charts {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 18px;
      align-items: start;
    }}
    figure {{
      margin: 0;
      border: 1px solid #e2e6eb;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }}
    figcaption {{
      font-weight: 700;
      margin: 0 0 8px;
      color: #27313e;
    }}
    svg {{
      width: 100%;
      height: auto;
      display: block;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 18px;
      font-size: 14px;
    }}
    th, td {{
      border-bottom: 1px solid #e2e6eb;
      padding: 8px 10px;
      text-align: left;
      white-space: nowrap;
    }}
    th {{
      background: #f1f4f7;
      color: #27313e;
    }}
    .missing {{
      color: #b00020;
      font-weight: 700;
    }}
    @media (max-width: 720px) {{
      header, main {{
        padding-left: 16px;
        padding-right: 16px;
      }}
      .charts {{
        grid-template-columns: 1fr;
      }}
      figure {{
        overflow-x: auto;
      }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>主题雷达图报告</h1>
    <p class="subtitle">输入：{html.escape(input_label)}<br>
    相对雷达图中，1.0 表示全体主题平均水平；高于 1.0 表示强于平均；“第1”表示该主题在对应指标上排名第一。</p>
  </header>
  <main>
    {''.join(cards)}
  </main>
</body>
</html>
"""
    Path(html_path).parent.mkdir(parents=True, exist_ok=True)
    Path(html_path).write_text(html_doc, encoding="utf-8")
