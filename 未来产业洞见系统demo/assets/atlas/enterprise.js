(() => {
  "use strict";

  const data = window.DASHBOARD_DATA;
  const source = data?.enterprise;
  const insightPayload = window.ENTERPRISE_INSIGHTS || {};
  const enterpriseInsights = insightPayload.insights || {};
  const normalizeEnterpriseName = value => String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/[\s\[\]【】()（）·,，.。'"“”‘’\-—_]/g, "")
    .replace(/有限责任公司$/, "有限公司");
  const displayEnterpriseName = window.FUSION_ENTERPRISE_NAME?.display || (value => String(value || ""));
  const enterpriseInsightsByNormalizedName = new Map();
  Object.entries(enterpriseInsights).forEach(([name, insight]) => {
    const normalized = normalizeEnterpriseName(name);
    if (normalized && !enterpriseInsightsByNormalizedName.has(normalized)) {
      enterpriseInsightsByNormalizedName.set(normalized, insight);
    }
  });
  if (!source || !window.echarts) return;
  // The China geography embed shares this bundle but does not display the
  // enterprise view. Avoid indexing and drawing thousands of companies there.
  if (document.documentElement.dataset.module === "china") return;

  const nf = new Intl.NumberFormat("zh-CN");
  const oneDecimal = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0, maximumFractionDigits: 1
  });
  const SECONDARY_PALETTE = ["#315c79", "#e9632d", "#8c174f", "#f3aa2c", "#8066a1", "#5a7a66", "#ac6c55", "#84687e", "#a9a39b"];
  const TERTIARY_PALETTE = ["#244b68", "#df7748", "#9d2d62", "#d99b2b", "#725c98", "#4e725e", "#a35f49", "#765d75", "#b4ada3"];
  const CHAIN_COLORS = {
    上游: "#315c79", 中游: "#e9632d", 下游: "#8c174f",
    不适用: "#bbb4aa", 缺失: "#ded8cf"
  };
  const POSITION_COLORS = {
    "上游企业": "#315c79",
    "中游企业": "#e9632d",
    "下游企业": "#8c174f"
  };
  const POSITIONS = ["上游", "中游", "下游"];
  const PATENT_QUALITY_METRICS = [
    { key: "valueScore", label: "合享价值度" },
    { key: "stabilityScore", label: "技术稳定性" },
    { key: "advancedScore", label: "技术先进性" },
    { key: "scopeScore", label: "保护范围" }
  ];
  const yearMin = data.meta.yearMin;
  const yearMax = data.meta.yearMax;
  const recentStart = yearMax - 4;
  const companies = (source.companies || []).filter(company =>
    (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
  );
  const directoryFallbackCompanies = (source.directoryFallbackCompanies || []).filter(company =>
    (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
  );
  const directoryFallbackByName = new Map(directoryFallbackCompanies.map(company => [company.name, company]));
  const companyByName = new Map([
    ...directoryFallbackCompanies.map(company => [company.name, company]),
    ...companies.map(company => [company.name, company])
  ]);
  const charts = [];

  function initChart(id) {
    const chart = echarts.init(document.getElementById(id), null, { renderer: "canvas" });
    charts.push(chart);
    return chart;
  }

  const strategyChart = initChart("enterpriseStrategy");
  const rankingChart = initChart("enterpriseRanking");
  const trendChart = initChart("enterpriseTrend");
  const chainChart = initChart("enterpriseChainChart");

  const state = {
    yearStart: yearMin,
    yearEnd: yearMax,
    tech: "",
    chain1: "",
    type: "",
    strategyScope: "all",
    selectedName: null
  };
  let currentViews = [];
  let detailView = null;
  let activeTrendDrill = null;
  let activeChainDrill = null;
  let trendResetTimer = null;
  let chainResetTimer = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }
  function splitLabels(value) {
    return String(value || "").split(/[；;]+/).map(item => item.trim()).filter(Boolean);
  }
  function routeKey(value) {
    const match = String(value || "").match(/\b(B[0-9])\b/);
    return match?.[1] || (String(value || "").includes("路线未界定") ? "路线未界定" : null);
  }
  function patentRoutes(patent) {
    return [...new Set(splitLabels(patent.tech).map(routeKey).filter(Boolean))];
  }
  function numberText(value) {
    return nf.format(Math.round(value || 0));
  }
  function metric(label, value, suffix = "") {
    return `<div class="metric"><span>${label}</span><strong>${value}</strong>${suffix ? `<small>${suffix}</small>` : ""}</div>`;
  }
  function percent(value) {
    return `${((value || 0) * 100).toFixed(1)}%`;
  }
  function numericQualityScore(value) {
    if (value === null || value === undefined || value === "") return null;
    const score = Number(value);
    return Number.isFinite(score) ? score : null;
  }
  function qualityScore(value, decimals = 0) {
    const score = numericQualityScore(value);
    return score === null ? "—" : score.toFixed(decimals);
  }
  function enterpriseQualityHtml(patents) {
    const rows = PATENT_QUALITY_METRICS.map(metricItem => {
      const values = (patents || []).map(patent => numericQualityScore(patent[metricItem.key])).filter(value => value !== null);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return `<div><dt>${escapeHtml(metricItem.label)}</dt><dd>${qualityScore(average, 1)}${average === null ? "" : "<small>/10</small>"}</dd><em>${numberText(values.length)} 件有效专利族</em></div>`;
    }).join("");
    return `
      <section class="enterprise-quality" aria-labelledby="enterpriseQualityHeading">
        <div class="enterprise-quality-head"><h5 id="enterpriseQualityHeading">专利价值与质量指标</h5><span>全期专利族算术均值 · 10分制</span></div>
        <dl class="enterprise-quality-metrics">${rows}</dl>
      </section>`;
  }
  function patentQualityHtml(patent) {
    const rows = PATENT_QUALITY_METRICS.map(metricItem => {
      const value = numericQualityScore(patent[metricItem.key]);
      return `<div><dt>${escapeHtml(metricItem.label)}</dt><dd>${qualityScore(value)}${value === null ? "" : "<small>/10</small>"}</dd></div>`;
    }).join("");
    return `<dl class="patent-quality-metrics" aria-label="专利价值与质量指标">${rows}</dl>`;
  }

  function renderEnterpriseInsight(company) {
    const container = document.getElementById("enterpriseInsight");
    if (!company) {
      container.innerHTML = '<div class="enterprise-insight-empty">选择企业后显示基于全期专利证据生成的技术布局分析。</div>';
      return;
    }
    const insight = enterpriseInsights[company.name]
      || enterpriseInsightsByNormalizedName.get(normalizeEnterpriseName(company.name));
    const qualityHtml = enterpriseQualityHtml(company.patents || []);
    if (!insight) {
      container.innerHTML = `${qualityHtml}<div class="enterprise-insight-empty">该企业尚无分析数据，请运行企业分析准备脚本。</div>`;
      return;
    }
    const delta = Number(insight.layout_score_delta || 0);
    const deltaClass = delta > 0 ? "up" : delta < 0 ? "down" : "";
    const deltaText = `${delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "— "}${delta.toFixed(2)}`;
    const statusText = insight.status === "generated" ? "智能体文案" : "证据摘要";
    const confidenceText = { high: "高", medium: "中", low: "低" }[insight.confidence] || "未知";
    const listHtml = (title, values) => Array.isArray(values) && values.length
      ? `<div class="enterprise-insight-list"><h5>${escapeHtml(title)}</h5><ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>`
      : "";
    const shareChips = (items, emptyText) => {
      const rows = (items || []).slice(0, 8);
      if (!rows.length) return `<span class="enterprise-insight-share-empty">${escapeHtml(emptyText)}</span>`;
      return rows.map(item => {
        const share = Number(item.share || 0);
        const count = Number(item.count || 0);
        return `<span title="标签提及 ${numberText(count)} 次">${escapeHtml(item.label || item)}<b>${(share * 100).toFixed(1)}%</b></span>`;
      }).join("");
    };
    const chain2Shares = shareChips(insight.top_chain2, "暂无产业链二级标签");
    const clusterShares = shareChips(insight.top_clusters, "暂无三级技术集群");
    const evidenceIds = (insight.evidence_patents || []).slice(0, 8).map(escapeHtml).join("、");
    container.innerHTML = `
      <div class="enterprise-insight-head">
        <div class="enterprise-insight-title">
          <span>技术布局</span>
          <strong>${Number(insight.layout_score || 0).toFixed(2)}</strong>
          <em class="${deltaClass}">${deltaText}</em>
        </div>
        <div class="enterprise-insight-meta">
          <span>${escapeHtml(insight.tier_label || "未分层")}</span>
          <span>证据置信度 ${escapeHtml(confidenceText)}</span>
          <span>${escapeHtml(statusText)}</span>
          <span>全期证据</span>
        </div>
      </div>
      <p class="enterprise-insight-lead">${escapeHtml(insight.headline || "暂无总体结论")}</p>
      ${qualityHtml}
      <div class="enterprise-insight-grid">
        <div class="enterprise-insight-block"><h5>技术布局</h5><p>${escapeHtml(insight.technology_layout || "暂无")}</p></div>
        <div class="enterprise-insight-block"><h5>产业链位置</h5><p>${escapeHtml(insight.chain_position || "暂无")}</p></div>
        <div class="enterprise-insight-block"><h5>时间演进</h5><p>${escapeHtml(insight.trend || "暂无")}</p></div>
      </div>
      <div class="enterprise-insight-facts">
        <div>
          <h5>产业链二级重点 <small>全期 Top 8 · 标签提及占比</small></h5>
          <div class="enterprise-insight-clusters">${chain2Shares}</div>
        </div>
        <div>
          <h5>三级技术集群 <small>全期 Top 8 · 标签提及占比</small></h5>
          <div class="enterprise-insight-clusters">${clusterShares}</div>
        </div>
      </div>
      <div class="enterprise-insight-lists">
        ${listHtml("证据支持的观察", insight.strengths)}
        ${listHtml("边界与注意事项", insight.risks)}
      </div>
      <p class="enterprise-insight-foot">${evidenceIds ? `代表专利：${evidenceIds}` : "代表专利：—"}${insight.generated_at ? ` · ${escapeHtml(insight.generated_at)}` : ""}</p>`;
  }

  function patentPasses(patent) {
    const year = Number(patent.year);
    if (!year || year < state.yearStart || year > state.yearEnd) return false;
    if (state.tech && !patentRoutes(patent).includes(state.tech)) return false;
    const chain1 = splitLabels(patent.chain1);
    if (state.chain1 && !chain1.includes(state.chain1)) return false;
    return true;
  }

  function positioning(ratios, validCount) {
    if (!validCount) return "定位未明确";
    const dominant = POSITIONS.reduce((best, candidate) =>
      ratios[candidate] > ratios[best] ? candidate : best
    );
    return `${dominant}企业`;
  }

  function computeCompany(company, patents) {
    const chain = { 上游: 0, 中游: 0, 下游: 0, 不适用: 0, 缺失: 0 };
    const weightedChain = { 上游: 0, 中游: 0, 下游: 0, 不适用: 0, 缺失: 0 };
    const routes = new Map();
    const chain2 = new Map();
    const chain3 = new Map();
    const years = new Map();
    let validCount = 0;
    let total = 0;
    let fractionalTotal = 0;
    let recent5 = 0;
    let cites = 0;
    let citedBy = 0;

    patents.forEach(patent => {
      const itemWeight = 1;
      total += itemWeight;
      fractionalTotal += Number(patent.fraction || 0);
      cites += Number(patent.cites || 0);
      citedBy += Number(patent.citedBy || 0);
      if (Number(patent.year) >= recentStart) recent5 += itemWeight;
      years.set(Number(patent.year), (years.get(Number(patent.year)) || 0) + itemWeight);
      const labels = splitLabels(patent.chain1);
      const validPositions = POSITIONS.filter(position => labels.includes(position));
      if (validPositions.length) {
        validCount += 1;
        validPositions.forEach(position => {
          chain[position] += 1;
          weightedChain[position] += itemWeight;
        });
      } else if (labels.includes("不适用")) {
        chain.不适用 += 1;
        weightedChain.不适用 += itemWeight;
      } else {
        chain.缺失 += 1;
        weightedChain.缺失 += itemWeight;
      }
      patentRoutes(patent).forEach(route => routes.set(route, (routes.get(route) || 0) + itemWeight));
      [...new Set(splitLabels(patent.chain2))]
        .filter(label => label !== "不适用")
        .forEach(label => chain2.set(label, (chain2.get(label) || 0) + itemWeight));
      [...new Set(splitLabels(patent.chain3))]
        .filter(label => label !== "不适用")
        .forEach(label => chain3.set(label, (chain3.get(label) || 0) + itemWeight));
    });

    const ratios = Object.fromEntries(POSITIONS.map(position => [position, validCount ? chain[position] / validCount : 0]));
    const ratioSum = POSITIONS.reduce((sum, position) => sum + ratios[position], 0) || 1;
    const normalized = Object.fromEntries(POSITIONS.map(position => [position, ratios[position] / ratioSum]));
    const dominantRoute = [...routes].sort((a, b) => b[1] - a[1])[0]?.[0] || "路线未界定";
    return {
      company, patents, chain, weightedChain, ratios, normalized, validCount,
      positioning: positioning(ratios, validCount),
      routes, chain2, chain3, years, total, fractionalTotal, recent5, cites, citedBy,
      dominantRoute,
      techBreadth: routes.size,
      chain2Breadth: chain2.size,
      x: normalized.中游 * .5 + normalized.下游,
      y: normalized.中游 * .866,
      activity: patents.length ? patents.filter(patent => Number(patent.year) >= recentStart).length / patents.length : 0
    };
  }

  function initialCompanyView(company) {
    const chain = { 上游: 0, 中游: 0, 下游: 0, 不适用: 0, 缺失: 0, ...(company.chain || {}) };
    const ratios = { 上游: 0, 中游: 0, 下游: 0, ...(company.ratios || {}) };
    const ratioSum = POSITIONS.reduce((sum, position) => sum + Number(ratios[position] || 0), 0) || 1;
    const normalized = Object.fromEntries(POSITIONS.map(position => [position, Number(ratios[position] || 0) / ratioSum]));
    const total = Number(company.value || company.patents?.length || 0);
    const recent5 = Number(company.recent5 || 0);
    return {
      company,
      patents: company.patents || [],
      chain,
      weightedChain: chain,
      ratios,
      normalized,
      validCount: POSITIONS.reduce((sum, position) => sum + Number(chain[position] || 0), 0),
      positioning: company.positioning || positioning(ratios, total),
      routes: new Map(), chain2: new Map(), chain3: new Map(), years: new Map(),
      total,
      fractionalTotal: Number(company.fractionalValue || total),
      recent5,
      cites: 0,
      citedBy: 0,
      dominantRoute: routeKey(company.patents?.[0]?.tech) || "路线未界定",
      techBreadth: 0,
      chain2Breadth: 0,
      x: normalized.中游 * .5 + normalized.下游,
      y: normalized.中游 * .866,
      activity: total ? recent5 / total : 0,
      lightweight: true
    };
  }

  function usesDefaultScope() {
    return state.yearStart === yearMin && state.yearEnd === yearMax
      && !state.tech && !state.chain1 && !state.type;
  }

  function filteredViews() {
    if (usesDefaultScope()) return companies.map(initialCompanyView);
    return companies
      .filter(company => !state.type || company.type === state.type)
      .map(company => {
        const patents = company.patents.filter(patentPasses);
        return patents.length ? computeCompany(company, patents) : null;
      })
      .filter(Boolean);
  }

  function activeSelected() {
    const primaryView = currentViews.find(view => view.company.name === state.selectedName);
    if (primaryView) return primaryView;
    const fallbackCompany = directoryFallbackByName.get(state.selectedName);
    if (!fallbackCompany) return null;
    return computeCompany(fallbackCompany, fallbackCompany.patents.filter(patentPasses));
  }

  function renderMetrics() {
    const enterpriseCount = currentViews.filter(view => view.company.type === "企业").length;
    const otherInstitutionCount = currentViews.length - enterpriseCount;
    const crossCount = currentViews.filter(view => POSITIONS.filter(position => view.chain[position] > 0).length >= 2).length;
    const newCount = currentViews.filter(view => Number(view.company.firstYear) >= recentStart).length;
    document.getElementById("enterpriseMetrics").innerHTML = [
      metric("企业数量", nf.format(enterpriseCount), "ENTERPRISE"),
      metric("其他机构数量", nf.format(otherInstitutionCount), "NON-ENTERPRISE"),
      metric("跨产业环节企业", nf.format(crossCount), "≥ 2 CHAIN STAGES"),
      metric("近五年新增企业", nf.format(newCount), `${recentStart}—${yearMax}`)
    ].join("");

  }

  function pointOffset(name) {
    let hash = 0;
    for (let index = 0; index < name.length; index += 1) {
      hash = ((hash << 5) - hash + name.charCodeAt(index)) | 0;
    }
    return [((hash & 15) - 7.5) * .65, (((hash >>> 4) & 15) - 7.5) * .65];
  }

  function strategyGroup(view) {
    const scaled = view.total > 5;
    const active = view.recent5 > 3;
    if (scaled && active) return "头部活跃";
    if (scaled) return "成熟存量";
    if (active) return "新兴成长";
    return "专业观察";
  }

  function strategySubjectPasses(view) {
    if (state.strategyScope === "all") return true;
    const isEnterprise = view.company.type === "企业";
    return state.strategyScope === "enterprise" ? isEnterprise : !isEnterprise;
  }

  function sampleProfessionalViews(views, limit = 36) {
    const cells = new Map();
    views.forEach(view => {
      const key = `${view.recent5}|${view.total}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(view);
    });
    const positionOrder = ["上游企业", "中游企业", "下游企业"];
    const orderedCells = [...cells.entries()]
      .sort((a, b) => {
        const [recentA, totalA] = a[0].split("|").map(Number);
        const [recentB, totalB] = b[0].split("|").map(Number);
        return recentB - recentA || totalB - totalA;
      })
      .map(([, cellViews]) => {
        const queues = new Map(positionOrder.map(position => [position, []]));
        cellViews.forEach(view => {
          if (!queues.has(view.positioning)) queues.set(view.positioning, []);
          queues.get(view.positioning).push(view);
        });
        queues.forEach(queue => queue.sort((a, b) => a.company.name.localeCompare(b.company.name, "zh-CN")));
        const effectivePositionOrder = [
          ...positionOrder,
          ...[...queues.keys()].filter(position => !positionOrder.includes(position))
        ];
        const ordered = [];
        while ([...queues.values()].some(queue => queue.length)) {
          effectivePositionOrder.forEach(position => {
            const next = queues.get(position)?.shift();
            if (next) ordered.push(next);
          });
        }
        return ordered;
      });
    const sampled = [];
    let depth = 0;
    while (sampled.length < limit && orderedCells.some(cell => depth < cell.length)) {
      orderedCells.forEach(cell => {
        if (sampled.length < limit && cell[depth]) sampled.push(cell[depth]);
      });
      depth += 1;
    }
    return sampled;
  }

  function renderStrategy() {
    const scopedViews = currentViews.filter(strategySubjectPasses);
    const topNames = new Set([...scopedViews].sort((a, b) => b.total - a.total).slice(0, 12).map(view => view.company.name));
    const viewByName = new Map(currentViews.map(view => [view.company.name, view]));
    const eligibleViews = scopedViews.filter(view => view.validCount > 0);
    const strategicViews = eligibleViews.filter(view => strategyGroup(view) !== "专业观察");
    const professionalViews = eligibleViews.filter(view => strategyGroup(view) === "专业观察");
    const plottedViews = [
      ...strategicViews,
      ...sampleProfessionalViews(professionalViews)
    ];
    const selectedView = eligibleViews.find(view => view.company.name === state.selectedName);
    if (selectedView && !plottedViews.includes(selectedView)) plottedViews.push(selectedView);
    const pointData = plottedViews.map(view => ({
      name: view.company.name,
      value: [Math.log10(1 + view.total), Math.log10(1 + view.recent5), view.total, view.recent5],
      symbolOffset: pointOffset(view.company.name),
      label: { show: topNames.has(view.company.name) || view.company.name === state.selectedName },
      itemStyle: {
        color: POSITION_COLORS[view.positioning],
        opacity: view.company.name === state.selectedName ? 1 : .76,
        borderColor: view.company.name === state.selectedName ? "#152337" : "rgba(255,253,249,.95)",
        borderWidth: view.company.name === state.selectedName ? 3 : 1.2,
        shadowBlur: view.company.name === state.selectedName ? 12 : 0,
        shadowColor: "rgba(21,35,55,.28)"
      }
    }));
    const xMax = Math.max(1, ...pointData.map(item => item.value[0])) * 1.08;
    const yMax = Math.max(.7, ...pointData.map(item => item.value[1])) * 1.12;
    const xThreshold = Math.log10(1 + 5);
    const yThreshold = Math.log10(1 + 3);
    strategyChart.setOption({
      animation: false,
      grid: { left: 78, right: 46, top: 52, bottom: 66 },
      toolbox: {
        right: 22, top: 12,
        feature: { dataZoom: { title: { zoom: "框选缩放", back: "缩放后退" } }, restore: { title: "重置" } },
        iconStyle: { borderColor: "#718092" }
      },
      xAxis: {
        type: "value", min: 0, max: xMax, name: "企业相关专利族规模  ·  LOG(1+X)",
        nameLocation: "middle", nameGap: 42, nameTextStyle: { color: "#718092", fontSize: 9 },
        axisLabel: { color: "#718092", fontSize: 9, formatter: value => nf.format(Math.max(0, Math.round(10 ** value - 1))) },
        axisLine: { lineStyle: { color: "rgba(21,35,55,.16)" } }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      yAxis: {
        type: "value", min: 0, max: yMax, name: `近五年新增专利族  ·  ${recentStart}—${yearMax}`,
        nameTextStyle: { color: "#718092", fontSize: 9, padding: [0, 0, 8, 0] },
        axisLabel: { color: "#718092", fontSize: 9, formatter: value => nf.format(Math.max(0, Math.round(10 ** value - 1))) },
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "rgba(21,35,55,.97)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 10 },
        formatter: params => {
          const view = viewByName.get(params.name);
          if (!view) return params.name;
          return `<b style="color:#f3aa2c">${escapeHtml(displayEnterpriseName(view.company.name))}</b><br>`
            + `${escapeHtml(view.company.type)} · ${escapeHtml(view.positioning)}<br>`
            + `专利族 <b>${numberText(view.total)}</b> · 近五年 ${numberText(view.recent5)}<br>`
            + `上游 ${percent(view.ratios.上游)} · 中游 ${percent(view.ratios.中游)} · 下游 ${percent(view.ratios.下游)}<br>`
            + `主导路线 ${escapeHtml(view.dominantRoute)} · 技术覆盖 ${nf.format(view.techBreadth)}`;
        }
      },
      series: [{
          name: "企业", type: "scatter", z: 4, data: pointData,
          progressive: 250,
          progressiveThreshold: 500,
          symbolSize: value => Math.max(6, Math.min(34, 4 + Math.sqrt(value[2] || 0) * 1.7)),
          markArea: {
            silent: true,
            label: { show: true, position: "insideTopLeft", color: "rgba(21,35,55,.38)", fontSize: 10, fontWeight: 600 },
            data: [
              [{ name: "专业观察", coord: [0, 0], itemStyle: { color: "rgba(49,92,121,.025)" } }, { coord: [xThreshold, yThreshold] }],
              [{ name: "新兴成长", coord: [0, yThreshold], itemStyle: { color: "rgba(243,170,44,.045)" } }, { coord: [xThreshold, yMax] }],
              [{ name: "成熟存量", coord: [xThreshold, 0], itemStyle: { color: "rgba(140,23,79,.025)" } }, { coord: [xMax, yThreshold] }],
              [{ name: "头部活跃", coord: [xThreshold, yThreshold], itemStyle: { color: "rgba(233,99,45,.045)" } }, { coord: [xMax, yMax] }]
            ]
          },
          markLine: {
            silent: true, symbol: "none", label: { show: false },
            lineStyle: { color: "rgba(21,35,55,.2)", width: 1, type: "dashed" },
            data: [{ xAxis: xThreshold }, { yAxis: yThreshold }]
          },
          label: {
            position: "right", distance: 5, color: "#34475a", fontSize: 8,
            width: 118, overflow: "truncate", formatter: params => displayEnterpriseName(params.name)
          },
          emphasis: { focus: "self", scale: 1.35, label: { show: true, color: "#8c174f", fontWeight: 600 } }
      }]
    }, true);
  }

  function renderRanking() {
    const ranked = [...currentViews].sort((a, b) => b.total - a.total || a.company.name.localeCompare(b.company.name, "zh-CN")).slice(0, 20);
    const categories = ranked.map(view => view.company.name).reverse();
    const valuesFor = label => ranked.map(view => view.weightedChain[label]).reverse();
    rankingChart.setOption({
      animationDuration: 450,
      color: [CHAIN_COLORS.上游, CHAIN_COLORS.中游, CHAIN_COLORS.下游, CHAIN_COLORS.不适用, CHAIN_COLORS.缺失],
      grid: { left: 260, right: 70, top: 56, bottom: 45 },
      legend: {
        top: 18, left: 260, itemWidth: 12, itemHeight: 6,
        textStyle: { color: "#687686", fontSize: 9 },
        data: ["上游", "中游", "下游"]
      },
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" }, confine: true,
        backgroundColor: "rgba(21,35,55,.97)", borderWidth: 0, textStyle: { color: "#fff", fontSize: 10 },
        formatter: params => `<b>${escapeHtml(displayEnterpriseName(params[0]?.axisValue || ""))}</b><br>`
          + params.map(item => `${item.marker}${item.seriesName}<b style="float:right;margin-left:25px">${numberText(item.value)}</b>`).join("<br>")
      },
      xAxis: {
        type: "value", minInterval: 1,
        axisLabel: { color: "#7d8894", fontSize: 9 }, axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      yAxis: {
        type: "category", data: categories, triggerEvent: true,
        axisLabel: { color: value => value === state.selectedName ? "#8c174f" : "#34475a", fontSize: 9, width: 225, overflow: "truncate", formatter: displayEnterpriseName },
        axisLine: { show: false }, axisTick: { show: false }
      },
      series: ["上游", "中游", "下游", "不适用", "缺失"].map(label => ({
        name: label, type: "bar", stack: "chain", data: valuesFor(label), barMaxWidth: 18,
        itemStyle: { color: CHAIN_COLORS[label], opacity: label === "缺失" ? .55 : 1 },
        emphasis: { focus: "series" }
      }))
    }, true);
  }

  function sortedEntries(map, limit = 16) {
    return [...map].sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  function detailYears(view) {
    const recordedYears = view.patents.map(patent => Number(patent.year)).filter(Number.isFinite);
    if (!recordedYears.length) return [];
    const start = Math.min(...recordedYears) - 1;
    const end = Math.max(...recordedYears);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  function patentHasPosition(patent, position) {
    return splitLabels(patent.chain1).includes(position);
  }

  function aggregateSecondaryByYear(view, position, years) {
    const yearSet = new Set(years);
    const labelYears = new Map();
    view.patents.forEach(patent => {
      if (!patentHasPosition(patent, position) || !yearSet.has(Number(patent.year))) return;
      const labels = splitLabels(patent.chain2).filter(label => label !== "不适用");
      const effectiveLabels = labels.length ? [...new Set(labels)] : ["二级标签未标注"];
      effectiveLabels.forEach(label => {
        if (!labelYears.has(label)) labelYears.set(label, new Map());
        const values = labelYears.get(label);
        values.set(Number(patent.year), (values.get(Number(patent.year)) || 0) + 1);
      });
    });
    const ranked = [...labelYears].sort((a, b) => {
      const totalA = [...a[1].values()].reduce((sum, value) => sum + value, 0);
      const totalB = [...b[1].values()].reduce((sum, value) => sum + value, 0);
      return totalB - totalA;
    });
    const retained = ranked.slice(0, 6);
    if (ranked.length > 6) {
      const other = new Map();
      ranked.slice(6).forEach(([, values]) => values.forEach((value, year) => {
        other.set(year, (other.get(year) || 0) + value);
      }));
      retained.push(["其他二级指标", other]);
    }
    return retained;
  }

  function renderEnterpriseTrend(view, drillPosition = null) {
    const years = detailYears(view);
    if (!years.length) {
      trendChart.clear();
      return;
    }
    const primarySeries = POSITIONS.map(position => {
      const active = !drillPosition || drillPosition === position;
      const values = years.map(year => view.patents.reduce((sum, patent) => (
        Number(patent.year) === year && patentHasPosition(patent, position) ? sum + 1 : sum
      ), 0));
      const hasData = values.some(value => value > 0);
      return {
        name: position,
        type: "line",
        stack: drillPosition ? undefined : "产业链一级",
        data: values,
        smooth: .18,
        symbol: hasData ? "circle" : "none",
        showSymbol: hasData,
        symbolSize: active ? 5 : 3,
        lineStyle: {
          color: CHAIN_COLORS[position],
          width: hasData ? (active ? 2.4 : 1) : 0,
          opacity: hasData ? (active ? 1 : .1) : 0
        },
        itemStyle: { color: CHAIN_COLORS[position], opacity: hasData ? (active ? 1 : .1) : 0 },
        areaStyle: {
          color: CHAIN_COLORS[position],
          opacity: hasData ? (drillPosition ? (active ? .05 : .008) : .13) : 0
        },
        emphasis: {
          disabled: !hasData,
          focus: "series",
          blurScope: "coordinateSystem",
          lineStyle: { width: 3.2 },
          areaStyle: { opacity: .2 }
        },
        z: active ? 4 : 1
      };
    });
    const drillPalette = ["#2b5877", "#e9632d", "#8c174f", "#f3aa2c", "#8066a1", "#5a7a66", "#ac6c55"];
    const secondaryEntries = drillPosition ? aggregateSecondaryByYear(view, drillPosition, years) : [];
    const secondarySeries = secondaryEntries.map(([label, values], index) => ({
      name: label,
      type: "line",
      stack: `${drillPosition}-产业二级`,
      data: years.map(year => values.get(year) || 0),
      smooth: .12,
      symbol: "emptyCircle",
      symbolSize: 4,
      lineStyle: { color: drillPalette[index % drillPalette.length], width: 1.4 },
      itemStyle: { color: drillPalette[index % drillPalette.length] },
      areaStyle: { color: drillPalette[index % drillPalette.length], opacity: .11 },
      emphasis: { focus: "series", blurScope: "coordinateSystem", lineStyle: { width: 2.6 } },
      z: 3
    }));
    const legendNames = drillPosition ? secondaryEntries.map(item => item[0]) : POSITIONS;
    trendChart.setOption({
      animationDuration: 320,
      title: drillPosition ? {
        text: `${drillPosition} · 产业二级下钻`,
        subtext: "移出图表返回上中下游概览",
        left: 16,
        top: 7,
        textStyle: { color: CHAIN_COLORS[drillPosition], fontSize: 10, fontWeight: 600 },
        subtextStyle: { color: "#8a949e", fontSize: 8 }
      } : undefined,
      legend: {
        type: "scroll",
        top: drillPosition ? 8 : 12,
        left: drillPosition ? 170 : "center",
        right: 16,
        data: legendNames,
        itemWidth: 13,
        itemHeight: 7,
        textStyle: { color: "#657382", fontSize: 8 }
      },
      grid: { left: 55, right: 24, top: 58, bottom: 42 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(21,35,55,.97)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 10 },
        formatter: params => {
          const shown = drillPosition
            ? params.filter(item => !POSITIONS.includes(item.seriesName))
            : params.filter(item => POSITIONS.includes(item.seriesName));
          return `<b>${escapeHtml(params[0]?.axisValue || "")}</b><br>`
            + shown.map(item => `${item.marker}${escapeHtml(item.seriesName)}<b style="float:right;margin-left:25px">${numberText(item.value)}</b>`).join("<br>");
        }
      },
      xAxis: {
        type: "category",
        data: years,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "rgba(21,35,55,.14)" } },
        axisLabel: {
          color: "#7b8792",
          fontSize: 8,
          interval: years.length > 30 ? 9 : years.length > 15 ? 4 : 0,
          formatter: value => Number(value) === yearMax ? `${value}\nYTD` : value
        }
      },
      yAxis: {
        type: "value",
        min: 0,
        minInterval: 1,
        axisLabel: { color: "#7b8792", fontSize: 8 },
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      series: [...primarySeries, ...secondarySeries]
    }, true);
  }

  function aggregateSecondaryTertiary(view, secondary, retainedSecondaries) {
    const totals = new Map();
    view.patents.forEach(patent => {
      const secondaryLabels = [...new Set(splitLabels(patent.chain2).filter(label => label !== "不适用"))];
      const matched = secondary === "其他二级指标"
        ? secondaryLabels.some(label => !retainedSecondaries.has(label))
        : secondaryLabels.includes(secondary);
      if (!matched) return;
      const tertiaryLabels = [...new Set(splitLabels(patent.chain3).filter(label => label !== "不适用"))];
      const effectiveLabels = tertiaryLabels.length ? tertiaryLabels : ["三级标签未标注"];
      effectiveLabels.forEach(label => totals.set(label, (totals.get(label) || 0) + 1));
    });
    const ranked = [...totals].sort((a, b) => b[1] - a[1]);
    const retained = ranked.slice(0, 8);
    if (ranked.length > 8) {
      retained.push(["其他三级标签", ranked.slice(8).reduce((sum, item) => sum + item[1], 0)]);
    }
    return retained;
  }

  function renderEnterpriseChain(view, drillSecondary = null) {
    const rankedSecondaries = [...view.chain2].sort((a, b) => b[1] - a[1]);
    const retainedSecondaries = new Set(rankedSecondaries.slice(0, 8).map(item => item[0]));
    const secondaryEntries = rankedSecondaries.slice(0, 8);
    if (rankedSecondaries.length > 8) {
      secondaryEntries.push(["其他二级指标", rankedSecondaries.slice(8).reduce((sum, item) => sum + item[1], 0)]);
    }
    const secondaryData = secondaryEntries.map((item, index) => ({
      name: item[0],
      value: item[1],
      itemStyle: {
        color: SECONDARY_PALETTE[index % SECONDARY_PALETTE.length],
        opacity: drillSecondary && drillSecondary !== item[0] ? .12 : 1
      },
      label: { show: !drillSecondary || drillSecondary === item[0] }
    }));
    const tertiaryEntries = drillSecondary ? aggregateSecondaryTertiary(view, drillSecondary, retainedSecondaries) : [];
    const tertiaryData = tertiaryEntries.map((item, index) => ({
      name: item[0],
      value: item[1],
      itemStyle: { color: TERTIARY_PALETTE[index % TERTIARY_PALETTE.length] }
    }));
    chainChart.setOption({
      animationDuration: 320,
      title: drillSecondary ? {
        text: drillSecondary,
        subtext: tertiaryEntries.length ? "产业链三级构成" : "暂无三级标签",
        left: "center",
        top: "35%",
        textStyle: { color: "#18324d", fontSize: 15, fontWeight: 600, width: 180, overflow: "truncate" },
        subtextStyle: { color: "#7b8792", fontSize: 10 }
      } : undefined,
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(21,35,55,.97)",
        borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: params => {
          const prefix = `${params.seriesName} · `;
          return `${params.marker}${prefix}${escapeHtml(params.name)}<br><b>${numberText(params.value)}</b> 件专利族`;
        }
      },
      legend: {
        bottom: 8,
        left: "center",
        data: secondaryData.map(item => item.name),
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        textStyle: { color: "#657382", fontSize: 10 }
      },
      series: [
        {
          name: "产业链二级",
          type: "pie",
          radius: drillSecondary ? ["29%", "48%"] : ["42%", "68%"],
          center: ["50%", "43%"],
          label: {
            color: "#4d5d6d",
            fontSize: 11,
            formatter: params => `${String(params.name).length > 9 ? `${String(params.name).slice(0, 9)}…` : params.name}\n${params.percent}%`
          },
          itemStyle: { borderColor: "#fbf8f3", borderWidth: 2 },
          emphasis: { focus: "self", scaleSize: 5 },
          data: secondaryData,
          z: 3
        },
        {
          name: "产业链三级",
          type: "pie",
          radius: ["55%", "75%"],
          center: ["50%", "43%"],
          minAngle: 2,
          label: {
            show: Boolean(drillSecondary),
            color: "#596878",
            fontSize: 10,
            formatter: params => `${String(params.name).length > 9 ? `${String(params.name).slice(0, 9)}…` : params.name}\n${numberText(params.value)}`
          },
          labelLine: { show: Boolean(drillSecondary), length: 8, length2: 5, lineStyle: { color: "rgba(21,35,55,.25)" } },
          itemStyle: { borderColor: "#fbf8f3", borderWidth: 1.5 },
          emphasis: { focus: "self", scaleSize: 4 },
          data: tertiaryData,
          z: 2
        }
      ]
    }, true);
    if (!drillSecondary) {
      requestAnimationFrame(() => {
        chainChart.dispatchAction({ type: "hideTip" });
        chainChart.dispatchAction({ type: "downplay", seriesIndex: 0 });
        chainChart.dispatchAction({ type: "downplay", seriesIndex: 1 });
      });
    }
  }

  function renderDetail() {
    let view = activeSelected();
    if (view?.lightweight) {
      view = computeCompany(view.company, view.company.patents.filter(patentPasses));
      const viewIndex = currentViews.findIndex(item => item.company.name === view.company.name);
      if (viewIndex >= 0) currentViews[viewIndex] = view;
    }
    detailView = view;
    activeTrendDrill = null;
    activeChainDrill = null;
    clearTimeout(trendResetTimer);
    clearTimeout(chainResetTimer);
    if (!view) {
      window.ShareholderLeads?.mount(document.getElementById("enterpriseShareholderLeads"), "");
      document.getElementById("enterpriseDetailName").textContent = "尚未选择企业";
      document.getElementById("enterpriseDetailPosition").textContent = "—";
      document.getElementById("enterpriseDetailMeta").innerHTML = "<span>从上方任一企业图表选择企业后显示完整画像。</span>";
      document.getElementById("enterpriseDetailMetrics").innerHTML = "";
      document.getElementById("enterprisePatentList").innerHTML = "";
      renderEnterpriseInsight(null);
      trendChart.clear();
      chainChart.clear();
      return;
    }
    const company = view.company;
    window.ShareholderLeads?.mount(document.getElementById("enterpriseShareholderLeads"), company.name);
    const insight = enterpriseInsights[company.name]
      || enterpriseInsightsByNormalizedName.get(normalizeEnterpriseName(company.name))
      || {};
    const listingLabels = {
      listed: "已上市",
      listed_subsidiary: "上市公司子公司",
      unlisted: "未上市",
      unknown: "待模型核验"
    };
    const listingStatus = insight.listed_status || "unknown";
    const listingDetail = [
      insight.listed_exchange,
      insight.stock_code
    ].filter(Boolean).join(" · ");
    const listingTitle = [
      insight.listing_basis,
      listingDetail
    ].filter(Boolean).join("；");
    document.getElementById("enterpriseDetailName").textContent = displayEnterpriseName(company.name);
    document.getElementById("enterpriseDetailPosition").textContent = view.positioning;
    document.getElementById("enterpriseDetailMeta").innerHTML = [
      `<span>企业类型 <b>${escapeHtml(company.type)}</b></span>`,
      `<span>国家 <b>${escapeHtml(company.countries.join("、") || "未标注")}</b></span>`,
      `<span>省 <b>${escapeHtml(company.provinces.join("、") || "未标注")}</b></span>`,
      `<span>市 <b>${escapeHtml(company.cities.join("、") || "未标注")}</b></span>`,
      `<span>专利关联口径 <b>${escapeHtml(company.profileScope || "当前权利人")}</b></span>`,
      `<span>首次相关专利 <b>${company.firstYear || "—"}</b></span>`,
      `<span>上市状态 <b class="enterprise-listing-badge is-${escapeHtml(listingStatus)}" title="${escapeHtml(listingTitle)}">${escapeHtml(listingLabels[listingStatus] || "待模型核验")}${listingDetail ? ` · ${escapeHtml(listingDetail)}` : ""}</b></span>`
    ].join("");
    const detailMetrics = [
      ["专利族数量", nf.format(view.patents.length), `分数计数 ${oneDecimal.format(view.fractionalTotal)}`],
      ["上游", nf.format(view.chain.上游), percent(view.ratios.上游)],
      ["中游", nf.format(view.chain.中游), percent(view.ratios.中游)],
      ["下游", nf.format(view.chain.下游), percent(view.ratios.下游)],
      ["近五年新增", nf.format(view.patents.filter(p => Number(p.year) >= recentStart).length), `${recentStart}—${yearMax}`],
      ["产业二级覆盖", nf.format(view.chain2Breadth), "去重标签"]
    ];
    document.getElementById("enterpriseDetailMetrics").innerHTML = detailMetrics.map(item => `<div class="enterprise-detail-metric"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></div>`).join("");
    renderEnterpriseInsight(company);

    renderEnterpriseTrend(view);
    renderEnterpriseChain(view);

    const representative = [...view.patents].sort((a, b) => Number(b.citedBy) - Number(a.citedBy) || String(b.date).localeCompare(String(a.date))).slice(0, 20);
    document.getElementById("enterprisePatentCount").textContent = `${nf.format(representative.length)} / ${nf.format(view.patents.length)} PATENTS`;
    document.getElementById("enterprisePatentList").innerHTML = representative.map(patent => `
      <article class="patent-card" tabindex="0" data-patent-id="${escapeHtml(patent.id)}">
        <div class="patent-card-head"><h4>${escapeHtml(patent.title || "未命名专利")}</h4><div class="patent-card-meta"><span>${escapeHtml(patent.id)}<br>${escapeHtml(patent.date || "日期未知")} · 被引 ${nf.format(patent.citedBy || 0)}</span></div></div>
        <div class="patent-extra">
          ${patentQualityHtml(patent)}
          <p class="patent-sao"><b>技术特征</b> · ${escapeHtml(patent.sao || "暂无技术特征描述")}</p>
          <div class="patent-tags">
            <span class="patent-tag tech">技术分类 · ${escapeHtml(patent.tech || "未标注")}</span>
            <span class="patent-tag chain1">一级 · ${escapeHtml(patent.chain1 || "未标注")}</span>
            <span class="patent-tag chain2">二级 · ${escapeHtml(patent.chain2 || "未标注")}</span>
            <span class="patent-tag chain3">三级 · ${escapeHtml(patent.chain3 || "未标注")}</span>
          </div>
        </div>
      </article>`).join("");
  }

  function renderPositionLegend() {
    document.getElementById("enterprisePositionLegend").innerHTML = Object.entries(POSITION_COLORS)
      .map(([label, color]) => `<span><i style="background:${color}"></i>${escapeHtml(label)}</span>`).join("");
  }

  function refreshAll() {
    currentViews = filteredViews();
    if (state.selectedName
      && !currentViews.some(view => view.company.name === state.selectedName)
      && !directoryFallbackByName.has(state.selectedName)) state.selectedName = null;
    renderMetrics();
    renderStrategy();
    renderRanking();
    renderDetail();
  }

  function selectEnterprise(name) {
    if (!companyByName.has(name)) return;
    state.selectedName = name;
    renderMetrics();
    renderStrategy();
    renderRanking();
    renderDetail();
  }

  window.openEnterpriseProfile = name => {
    if (!companyByName.has(name)) return;
    selectEnterprise(name);
    document.querySelector('[data-enterprise-mode="patent"]')?.click();
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    requestAnimationFrame(() => document.getElementById("enterpriseDetail")?.scrollIntoView({ behavior, block: "start" }));
  };
  window.addEventListener("message", event => {
    if (event.data?.type !== "fusion:open-enterprise" || !event.data.company) return;
    window.openEnterpriseProfile(String(event.data.company));
  });

  strategyChart.on("click", event => {
    if (event.seriesName === "企业" && event.name) selectEnterprise(event.name);
  });
  trendChart.on("mouseover", event => {
    if (!detailView || !POSITIONS.includes(event.seriesName)) return;
    clearTimeout(trendResetTimer);
    if (activeTrendDrill === event.seriesName) return;
    activeTrendDrill = event.seriesName;
    renderEnterpriseTrend(detailView, activeTrendDrill);
  });
  trendChart.on("globalout", () => {
    clearTimeout(trendResetTimer);
    trendResetTimer = setTimeout(() => {
      if (!detailView || !activeTrendDrill) return;
      activeTrendDrill = null;
      renderEnterpriseTrend(detailView);
    }, 180);
  });
  chainChart.on("mouseover", event => {
    if (!detailView || event.seriesName !== "产业链二级" || !event.name) return;
    clearTimeout(chainResetTimer);
    if (activeChainDrill === event.name) return;
    activeChainDrill = event.name;
    renderEnterpriseChain(detailView, activeChainDrill);
  });
  function resetEnterpriseChainDrill() {
    clearTimeout(chainResetTimer);
    if (!detailView || !activeChainDrill) return;
    activeChainDrill = null;
    chainChart.dispatchAction({ type: "hideTip" });
    chainChart.dispatchAction({ type: "downplay", seriesIndex: 0 });
    chainChart.dispatchAction({ type: "downplay", seriesIndex: 1 });
    renderEnterpriseChain(detailView);
  }
  function scheduleEnterpriseChainReset(delay = 90) {
    clearTimeout(chainResetTimer);
    chainResetTimer = setTimeout(resetEnterpriseChainDrill, delay);
  }
  chainChart.on("mouseout", event => {
    if (event.seriesName === "产业链二级" || event.seriesName === "产业链三级") {
      scheduleEnterpriseChainReset();
    }
  });
  chainChart.on("globalout", () => scheduleEnterpriseChainReset(60));
  const enterpriseChainElement = document.getElementById("enterpriseChainChart");
  enterpriseChainElement.addEventListener("pointerenter", () => clearTimeout(chainResetTimer));
  enterpriseChainElement.addEventListener("pointerleave", () => scheduleEnterpriseChainReset(40));
  window.addEventListener("blur", resetEnterpriseChainDrill);
  rankingChart.on("click", event => {
    const name = event.componentType === "yAxis" ? event.value : event.name;
    if (!companyByName.has(name)) return;
    selectEnterprise(name);
    document.getElementById("enterpriseDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("enterpriseStrategyReset").addEventListener("click", () => {
    strategyChart.dispatchAction({ type: "restore" });
  });
  document.getElementById("enterpriseStrategyScope").addEventListener("click", event => {
    const button = event.target.closest("[data-strategy-scope]");
    if (!button || button.dataset.strategyScope === state.strategyScope) return;
    state.strategyScope = button.dataset.strategyScope;
    document.querySelectorAll("[data-strategy-scope]").forEach(item => {
      const active = item.dataset.strategyScope === state.strategyScope;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderStrategy();
  });
  document.getElementById("enterprisePatentList").addEventListener("click", event => {
    const card = event.target.closest(".patent-card");
    if (card) card.classList.toggle("expanded");
  });
  document.getElementById("enterprisePatentList").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".patent-card");
    if (card) {
      event.preventDefault();
      card.classList.toggle("expanded");
    }
  });
  document.querySelector('[data-view="enterprise"]').addEventListener("click", () => {
    requestAnimationFrame(() => charts.forEach(chart => chart.resize()));
  });
  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => charts.forEach(chart => chart.resize()));
  });

  renderPositionLegend();
  currentViews = filteredViews();
  renderMetrics();
  renderStrategy();
  renderRanking();
  renderDetail();
  const requestedCompany = new URLSearchParams(location.search).get("company");
  if (requestedCompany) setTimeout(() => window.openEnterpriseProfile(requestedCompany), 0);
})();
