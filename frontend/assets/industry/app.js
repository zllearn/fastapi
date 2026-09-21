(() => {
  "use strict";

  const lensData = window.DASHBOARD_DATA;
  const techAdvantageMatrix = document.getElementById("techAdvantageMatrix");
  const chainGapAnalysis = document.getElementById("chainGapAnalysis");
  const chains = ["上游", "中游", "下游"];
  const colors = { 上游: "#315c79", 中游: "#e9632d", 下游: "#8c174f" };
  const techNames = {
    B1: "磁约束聚变 MCF",
    B2: "FRC 与紧凑环聚变",
    B3: "磁惯性聚变 MIF",
    B4: "惯性约束聚变 ICF",
    B5: "替代、非热及其他聚变路线",
    B6: "LENR 与凝聚态低能核反应",
    B7: "通用聚变支撑技术",
    B8: "聚变基础科学",
    B9: "潜力应用",
    "路线未界定": "路线未界定",
    "未分类": "未分类"
  };

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const split = value => [...new Set(String(value || "").split(/[;；\n、|]+/).map(item => item.trim()).filter(Boolean))];
  const benchmarkNodes = Array.isArray(lensData?.benchmark?.patents) ? lensData.benchmark.patents : [];
  const recordedYears = benchmarkNodes.map(node => Number(node.year)).filter(Number.isFinite);
  const benchmarkYearMax = Number(lensData?.meta?.yearMax) || Math.max(...recordedYears, new Date().getFullYear());
  const benchmarkYearMin = Number(lensData?.meta?.yearMin) || Math.min(...recordedYears, benchmarkYearMax);
  let benchmarkStartYear = benchmarkYearMin;
  let benchmarkEndYear = benchmarkYearMax;
  let benchmarkCountryA = "中国";
  let benchmarkCountryB = "美国";
  let benchmarkSecondaryLabels = [];

  const valuesOf = value => Array.isArray(value) ? value.filter(Boolean) : split(value);
  const normalizeBenchmarkCountry = value => {
    const country = String(value || "").trim();
    return ["中国台湾", "台湾", "中国香港", "香港"].includes(country) ? "中国" : country;
  };
  const benchmarkCountriesOf = patent => [...new Set(valuesOf(patent.countries)
    .map(normalizeBenchmarkCountry).filter(Boolean))];
  const technologyCode = value => String(value || "").match(/\bB[0-9]\b/i)?.[0].toUpperCase() || "";

  function countBy(items, values) {
    const result = new Map();
    items.forEach(item => [...new Set(values(item).filter(Boolean))]
      .forEach(key => result.set(key, (result.get(key) || 0) + 1)));
    return [...result].map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key), "zh-CN"));
  }

  const benchmarkSecondaryValues = item => valuesOf(item.chain2 || item.industryLevel2)
    .filter(label => label !== "不适用");
  const countryTotals = countBy(benchmarkNodes, benchmarkCountriesOf)
    .filter(row => row.key && row.key !== "国家未识别");
  const availableCountries = countryTotals.map(row => row.key);
  const availableCountrySet = new Set(availableCountries);
  const countryTotalMap = new Map(countryTotals.map(row => [row.key, row.count]));
  const numberFormat = new Intl.NumberFormat("zh-CN");
  const initialParams = new URLSearchParams(location.search);
  const requestedStartValue = initialParams.get("benchmarkStart");
  const requestedEndValue = initialParams.get("benchmarkEnd");
  const requestedStartYear = requestedStartValue === null ? NaN : Number(requestedStartValue);
  const requestedEndYear = requestedEndValue === null ? NaN : Number(requestedEndValue);
  if (Number.isFinite(requestedStartYear)) benchmarkStartYear = Math.max(benchmarkYearMin, Math.min(benchmarkYearMax, requestedStartYear));
  if (Number.isFinite(requestedEndYear)) benchmarkEndYear = Math.max(benchmarkStartYear, Math.min(benchmarkYearMax, requestedEndYear));

  const percent = value => `${(Number(value || 0) * 100).toFixed(1)}%`;
  const technologyLabel = code => techNames[code] || code;

  function tagDistribution(items, accessor, allowed = null) {
    const rows = countBy(items, accessor).filter(row => !allowed || allowed.has(row.key));
    const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
    return {
      total,
      rows,
      count: new Map(rows.map(row => [row.key, row.count])),
      share: new Map(rows.map(row => [row.key, row.count / total]))
    };
  }

  function sampleWarning(countryAItems, countryBItems) {
    const warnings = [];
    if (countryAItems.length < 30) warnings.push(`${benchmarkCountryA}仅 ${numberFormat.format(countryAItems.length)} 个专利族`);
    if (countryBItems.length < 30) warnings.push(`${benchmarkCountryB}仅 ${numberFormat.format(countryBItems.length)} 个专利族`);
    return warnings.join("，");
  }

  function renderTechnologyAdvantage(globalItems, countryAItems, countryBItems, scopeLabel) {
    const codes = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"];
    const allowed = new Set(codes);
    const accessor = item => valuesOf(item.tech || item.technologyDimension).map(technologyCode).filter(code => allowed.has(code));
    const globalDist = tagDistribution(globalItems, accessor, allowed);
    const countryADist = tagDistribution(countryAItems, accessor, allowed);
    const countryBDist = tagDistribution(countryBItems, accessor, allowed);
    const rta = (dist, code) => {
      const globalShare = globalDist.share.get(code) || 0;
      return globalShare > 0 ? (dist.share.get(code) || 0) / globalShare : 0;
    };
    const cell = (value, share, countryClass) => {
      const level = value >= 1.2 ? "strong" : value >= 1 ? "advantage" : value >= .8 ? "balanced" : "weak";
      return `<div class="rta-cell ${countryClass} ${level}" title="RTA ${value.toFixed(2)}；本国技术组合占比 ${percent(share)}">
        <strong>${value.toFixed(2)}</strong><small>${percent(share)}</small></div>`;
    };
    const rows = codes.map(code => {
      const countryARta = rta(countryADist, code);
      const countryBRta = rta(countryBDist, code);
      return `<div class="rta-row">
        <div class="rta-route"><b>${code}</b><span>${escapeHtml(technologyLabel(code))}</span></div>
        ${cell(countryARta, countryADist.share.get(code) || 0, "country-a")}
        ${cell(countryBRta, countryBDist.share.get(code) || 0, "country-b")}
      </div>`;
    }).join("");
    const strongest = dist => codes.map(code => ({ code, value: rta(dist, code) })).sort((a, b) => b.value - a.value)[0];
    const countryALead = strongest(countryADist);
    const countryBLead = strongest(countryBDist);
    const warning = sampleWarning(countryAItems, countryBItems);
    const conclusion = warning || `${escapeHtml(benchmarkCountryA)}专业化程度最高的是 ${countryALead.code}「${escapeHtml(technologyLabel(countryALead.code))}」（RTA ${countryALead.value.toFixed(2)}）；${escapeHtml(benchmarkCountryB)}为 ${countryBLead.code}「${escapeHtml(technologyLabel(countryBLead.code))}」（RTA ${countryBLead.value.toFixed(2)}）。`;
    techAdvantageMatrix.innerHTML = `<div class="rta-header"><span>技术路线</span><span>${escapeHtml(benchmarkCountryA)}<br><small>${numberFormat.format(countryAItems.length)} 个专利族</small></span><span>${escapeHtml(benchmarkCountryB)}<br><small>${numberFormat.format(countryBItems.length)} 个专利族</small></span></div>
      ${rows}
      <div class="benchmark-insight"><b>矩阵结论 · ${escapeHtml(scopeLabel)}</b>${conclusion}</div>`;
  }

  function renderChainGap(countryAItems, countryBItems, scopeLabel) {
    const chainAccessor = item => valuesOf(item.chain1 || item.industryDimension || item.industryLevel1).filter(label => chains.includes(label));
    const countryAChain = tagDistribution(countryAItems, chainAccessor, new Set(chains));
    const countryBChain = tagDistribution(countryBItems, chainAccessor, new Set(chains));
    const chainCards = chains.map(label => {
      const countryAShare = countryAChain.share.get(label) || 0;
      const countryBShare = countryBChain.share.get(label) || 0;
      const delta = countryAShare - countryBShare;
      return `<div class="chain-gap-card" style="--chain-color:${colors[label]}"><span>${label}</span><strong class="${delta >= 0 ? "positive" : "negative"}">${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}<small> pp</small></strong><em>${escapeHtml(benchmarkCountryA)} ${percent(countryAShare)} · ${escapeHtml(benchmarkCountryB)} ${percent(countryBShare)}</em></div>`;
    }).join("");

    const countryASecondary = tagDistribution(countryAItems, benchmarkSecondaryValues);
    const countryBSecondary = tagDistribution(countryBItems, benchmarkSecondaryValues);
    const gaps = benchmarkSecondaryLabels.map(label => {
      const countryAShare = countryASecondary.share.get(label) || 0;
      const countryBShare = countryBSecondary.share.get(label) || 0;
      return { label, countryAShare, countryBShare, delta: countryAShare - countryBShare };
    });
    const maxGap = Math.max(...gaps.map(item => Math.abs(item.delta)), .001);
    const gapRows = gaps.map(item => {
      const width = Math.max(2, Math.abs(item.delta) / maxGap * 50);
      const positive = item.delta >= 0;
      return `<div class="gap-row" title="${escapeHtml(benchmarkCountryA)} ${percent(item.countryAShare)}；${escapeHtml(benchmarkCountryB)} ${percent(item.countryBShare)}">
        <span class="gap-label">${escapeHtml(item.label)}</span>
        <div class="gap-track"><i class="gap-zero"></i><b class="gap-bar ${positive ? "positive" : "negative"}" style="--gap-width:${width}%"></b></div>
        <strong class="gap-value ${positive ? "positive" : "negative"}">${positive ? "+" : ""}${(item.delta * 100).toFixed(1)} pp</strong>
      </div>`;
    }).join("");
    const countryALead = [...gaps].filter(item => item.delta > 0).sort((a, b) => b.delta - a.delta)[0];
    const countryBLead = [...gaps].filter(item => item.delta < 0).sort((a, b) => a.delta - b.delta)[0];
    const warning = sampleWarning(countryAItems, countryBItems);
    const insight = warning || (gaps.length
      ? `${escapeHtml(benchmarkCountryA)}相对突出的二级环节为「${escapeHtml(countryALead?.label || "暂无显著项")}」，${escapeHtml(benchmarkCountryB)}相对突出的二级环节为「${escapeHtml(countryBLead?.label || "暂无显著项")}」。`
      : "当前数据缺少可比较的产业二级标签。");
    chainGapAnalysis.innerHTML = `<div class="chain-gap-cards">${chainCards}</div>
      <div class="gap-axis"><span>← ${escapeHtml(benchmarkCountryB)}相对突出</span><b>产业二级占比差值 · 两国全期总量 TOP 10</b><span>${escapeHtml(benchmarkCountryA)}相对突出 →</span></div>
      <div class="gap-list">${gapRows || '<div class="empty">暂无产业二级差值数据</div>'}</div>
      <div class="benchmark-insight"><b>差值结论 · ${escapeHtml(scopeLabel)}</b>${insight}</div>`;
  }

  function renderBenchmarks() {
    if (!lensData || !benchmarkNodes.length) {
      techAdvantageMatrix.innerHTML = chainGapAnalysis.innerHTML = '<div class="empty">数据未加载，无法计算对比指标。</div>';
      return;
    }
    const fullRange = benchmarkStartYear === benchmarkYearMin && benchmarkEndYear === benchmarkYearMax;
    const scopedNodes = benchmarkNodes.filter(node => {
      const year = Number(node.year);
      return Number.isFinite(year)
        ? year >= benchmarkStartYear && year <= benchmarkEndYear
        : fullRange;
    });
    const countryAItems = scopedNodes.filter(node => benchmarkCountriesOf(node).includes(benchmarkCountryA));
    const countryBItems = scopedNodes.filter(node => benchmarkCountriesOf(node).includes(benchmarkCountryB));
    const scopeLabel = `${benchmarkStartYear}–${benchmarkEndYear}`;
    const benchmarkTitle = document.getElementById("benchmarkTitle");
    if (benchmarkTitle) benchmarkTitle.textContent = `${benchmarkCountryA}—${benchmarkCountryB}产业技术对比`;
    renderTechnologyAdvantage(scopedNodes, countryAItems, countryBItems, scopeLabel);
    renderChainGap(countryAItems, countryBItems, scopeLabel);
  }

  function updateBenchmarkSecondaryLabels() {
    const pairNodes = benchmarkNodes.filter(node => {
      const countries = benchmarkCountriesOf(node);
      return countries.includes(benchmarkCountryA) || countries.includes(benchmarkCountryB);
    });
    benchmarkSecondaryLabels = countBy(pairNodes, benchmarkSecondaryValues).slice(0, 10).map(row => row.key);
  }

  function persistBenchmarkState() {
    try {
      const url = new URL(location.href);
      url.searchParams.set("countryA", benchmarkCountryA);
      url.searchParams.set("countryB", benchmarkCountryB);
      url.searchParams.set("benchmarkStart", benchmarkStartYear);
      url.searchParams.set("benchmarkEnd", benchmarkEndYear);
      history.replaceState(null, "", url);
    } catch (_) {
      // file:// 预览环境中无法写入历史状态时，不影响对比功能。
    }
  }

  const benchmarkCountryAInput = document.getElementById("benchmarkCountryA");
  const benchmarkCountryBInput = document.getElementById("benchmarkCountryB");
  const benchmarkCountryOptions = document.getElementById("benchmarkCountryOptions");

  function markCountryInputInvalid(input, message) {
    input.classList.add("invalid");
    input.title = message;
    window.setTimeout(() => input.classList.remove("invalid"), 900);
  }

  function commitCountryInput(slot, input, strict = false) {
    const next = input.value.trim();
    const other = slot === "A" ? benchmarkCountryB : benchmarkCountryA;
    const current = slot === "A" ? benchmarkCountryA : benchmarkCountryB;
    if (!availableCountrySet.has(next)) {
      if (strict) {
        markCountryInputInvalid(input, "请从国家列表中选择");
        input.value = current;
      }
      return;
    }
    if (next === other) {
      markCountryInputInvalid(input, "两个对比国家不能相同");
      input.value = current;
      return;
    }
    input.title = `${next}：全期 ${numberFormat.format(countryTotalMap.get(next) || 0)} 个专利族`;
    if (next === current) return;
    if (slot === "A") benchmarkCountryA = next;
    else benchmarkCountryB = next;
    updateBenchmarkSecondaryLabels();
    persistBenchmarkState();
    scheduleBenchmarkRender();
  }

  function initializeBenchmarkCountries() {
    if (!benchmarkCountryAInput || !benchmarkCountryBInput || !benchmarkCountryOptions || availableCountries.length < 2) return;
    benchmarkCountryOptions.innerHTML = countryTotals.map(row => `<option value="${escapeHtml(row.key)}" label="${numberFormat.format(row.count)} 个专利族"></option>`).join("");
    const requestedA = initialParams.get("countryA");
    const requestedB = initialParams.get("countryB");
    benchmarkCountryA = availableCountrySet.has(requestedA) ? requestedA
      : availableCountrySet.has("中国") ? "中国" : availableCountries[0];
    benchmarkCountryB = availableCountrySet.has(requestedB) && requestedB !== benchmarkCountryA ? requestedB
      : availableCountrySet.has("美国") && benchmarkCountryA !== "美国" ? "美国"
        : availableCountries.find(country => country !== benchmarkCountryA);
    benchmarkCountryAInput.value = benchmarkCountryA;
    benchmarkCountryBInput.value = benchmarkCountryB;
    benchmarkCountryAInput.title = `${benchmarkCountryA}：全期 ${numberFormat.format(countryTotalMap.get(benchmarkCountryA) || 0)} 个专利族`;
    benchmarkCountryBInput.title = `${benchmarkCountryB}：全期 ${numberFormat.format(countryTotalMap.get(benchmarkCountryB) || 0)} 个专利族`;
    [["A", benchmarkCountryAInput], ["B", benchmarkCountryBInput]].forEach(([slot, input]) => {
      input.addEventListener("input", () => commitCountryInput(slot, input, false));
      input.addEventListener("change", () => commitCountryInput(slot, input, true));
      input.addEventListener("blur", () => commitCountryInput(slot, input, true));
      input.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        commitCountryInput(slot, input, true);
        input.blur();
      });
    });
    updateBenchmarkSecondaryLabels();
  }

  const benchmarkStartInput = document.getElementById("benchmarkYearStart");
  const benchmarkEndInput = document.getElementById("benchmarkYearEnd");
  const benchmarkStartText = document.getElementById("benchmarkYearStartText");
  const benchmarkEndText = document.getElementById("benchmarkYearEndText");
  const benchmarkMinText = document.getElementById("benchmarkYearMinText");
  const benchmarkMaxText = document.getElementById("benchmarkYearMaxText");
  const benchmarkFill = document.getElementById("benchmarkYearFill");
  let benchmarkRenderFrame = 0;

  function syncBenchmarkTimeline() {
    const span = Math.max(1, benchmarkYearMax - benchmarkYearMin);
    const startPercent = (benchmarkStartYear - benchmarkYearMin) / span * 100;
    const endPercent = (benchmarkEndYear - benchmarkYearMin) / span * 100;
    if (benchmarkStartText) benchmarkStartText.textContent = benchmarkStartYear;
    if (benchmarkEndText) benchmarkEndText.textContent = benchmarkEndYear;
    if (benchmarkFill) {
      benchmarkFill.style.left = `${startPercent}%`;
      benchmarkFill.style.right = `${100 - endPercent}%`;
    }
    if (benchmarkStartInput && benchmarkEndInput) {
      benchmarkStartInput.style.zIndex = benchmarkStartYear >= benchmarkEndYear - 1 ? "4" : "3";
      benchmarkEndInput.style.zIndex = benchmarkStartYear >= benchmarkEndYear - 1 ? "3" : "4";
    }
  }

  function scheduleBenchmarkRender() {
    cancelAnimationFrame(benchmarkRenderFrame);
    benchmarkRenderFrame = requestAnimationFrame(renderBenchmarks);
  }

  function initializeBenchmarkTimeline() {
    if (!benchmarkStartInput || !benchmarkEndInput) return;
    [benchmarkStartInput, benchmarkEndInput].forEach(input => {
      input.min = benchmarkYearMin;
      input.max = benchmarkYearMax;
      input.step = 1;
    });
    benchmarkStartInput.value = benchmarkStartYear;
    benchmarkEndInput.value = benchmarkEndYear;
    if (benchmarkMinText) benchmarkMinText.textContent = benchmarkYearMin;
    if (benchmarkMaxText) benchmarkMaxText.textContent = benchmarkYearMax;
    benchmarkStartInput.addEventListener("input", () => {
      benchmarkStartYear = Math.min(Number(benchmarkStartInput.value), benchmarkEndYear);
      benchmarkStartInput.value = benchmarkStartYear;
      syncBenchmarkTimeline();
      persistBenchmarkState();
      scheduleBenchmarkRender();
    });
    benchmarkEndInput.addEventListener("input", () => {
      benchmarkEndYear = Math.max(Number(benchmarkEndInput.value), benchmarkStartYear);
      benchmarkEndInput.value = benchmarkEndYear;
      syncBenchmarkTimeline();
      persistBenchmarkState();
      scheduleBenchmarkRender();
    });
    syncBenchmarkTimeline();
  }

  window.addEventListener("message", event => {
    if (event.data?.type !== "fusion:embed-height") return;
    const target = event.data.module === "industry" ? document.getElementById("matrixEmbed")
      : event.data.module === "china" ? document.getElementById("chinaEmbed") : null;
    if (!target) return;
    const height = Math.max(event.data.module === "industry" ? 760 : 1200, Number(event.data.height) || 0);
    target.style.height = `${Math.ceil(height)}px`;
  });

  initializeBenchmarkCountries();
  initializeBenchmarkTimeline();
  renderBenchmarks();
})();
