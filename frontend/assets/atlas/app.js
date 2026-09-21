(() => {
  "use strict";

  const data = window.DASHBOARD_DATA;
  if (!window.echarts || !data || !echarts.getMap("world") || !echarts.getMap("china")) {
    document.getElementById("loadingError").hidden = false;
    return;
  }

  function normalizeInstitutionType(value) {
    return ["私企", "国企"].includes(value) ? "企业" : value;
  }
  function mergeInstitutionTypeCounts(types) {
    if (!types || Array.isArray(types) || typeof types !== "object") return types;
    if (!("私企" in types) && !("国企" in types)) return types;
    const merged = { 企业: Number(types.私企 || 0) + Number(types.国企 || 0) };
    Object.entries(types).forEach(([type, count]) => {
      if (!["私企", "国企"].includes(type)) merged[type] = count;
    });
    return merged;
  }
  function normalizeInstitutionTypes(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(item => normalizeInstitutionTypes(item, seen));
      return;
    }
    if (typeof value.type === "string") value.type = normalizeInstitutionType(value.type);
    if (value.types) value.types = mergeInstitutionTypeCounts(value.types);
    Object.values(value).forEach(item => normalizeInstitutionTypes(item, seen));
  }
  data.types = Array.from(new Set((data.types || []).map(normalizeInstitutionType)));
  normalizeInstitutionTypes(data);

  const COLORS = ["#e9632d", "#8c174f", "#f3aa2c", "#315c79", "#5a7a66", "#84687e", "#bbb4aa"];
  const LINE_COLORS = ["#e9632d", "#8c174f", "#315c79", "#f3aa2c", "#5a7a66", "#8066a1", "#ac6c55", "#436b70"];
  const TYPE_COLOR = Object.fromEntries(data.types.map((type, index) => [type, COLORS[index]]));
  const nf = new Intl.NumberFormat("zh-CN");
  const compact = new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 });
  const charts = [];
  const countryByMapName = new Map(data.world.countries.filter(d => d.mapName).map(d => [d.mapName, d]));
  const countryByName = new Map(data.world.countries.map(d => [d.name, d]));
  const provinceByName = new Map(data.china.provinces.map(d => [d.name, d]));
  const cityByName = new Map(data.china.cities.map(d => [d.name, d]));
  const benchmarkPatents = Array.isArray(data.benchmark?.patents) ? data.benchmark.patents : [];
  const chinaBenchmarkPatents = benchmarkPatents.filter(patent => (patent.countries || []).includes("中国"));
  const CHAIN_LEVELS = ["上游", "中游", "下游"];
  const TECH_CODES = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"];
  const TECH_NAMES = {
    B1: "磁约束聚变 MCF", B2: "FRC 与紧凑环聚变",
    B3: "磁惯性聚变 MIF", B4: "惯性约束聚变 ICF", B5: "替代、非热及其他聚变路线",
    B6: "LENR 与凝聚态低能核反应", B7: "通用聚变支撑技术",
    B8: "聚变基础科学", B9: "潜力应用"
  };

  const PROVINCE_COORDS = {
    北京: [116.40, 39.90], 天津: [117.20, 39.12], 上海: [121.47, 31.23], 重庆: [106.55, 29.56],
    河北: [114.52, 38.05], 山西: [112.55, 37.87], 辽宁: [123.43, 41.80], 吉林: [125.32, 43.90],
    黑龙江: [126.64, 45.76], 江苏: [118.78, 32.04], 浙江: [120.15, 30.27], 安徽: [117.27, 31.86],
    福建: [119.30, 26.08], 江西: [115.86, 28.68], 山东: [117.00, 36.68], 河南: [113.63, 34.75],
    湖北: [114.30, 30.59], 湖南: [112.98, 28.20], 广东: [113.27, 23.13], 海南: [110.33, 20.03],
    四川: [104.07, 30.67], 贵州: [106.71, 26.58], 云南: [102.71, 25.04], 陕西: [108.94, 34.34],
    甘肃: [103.84, 36.06], 青海: [101.78, 36.62], 台湾: [121.00, 23.70], 内蒙古: [111.75, 40.84],
    广西: [108.32, 22.82], 西藏: [91.11, 29.65], 宁夏: [106.23, 38.49], 新疆: [87.62, 43.82],
    香港: [114.17, 22.32], 澳门: [113.54, 22.20]
  };

  function fmt(value) { return nf.format(value || 0); }
  function listValues(value) {
    return Array.isArray(value)
      ? value.filter(Boolean)
      : String(value || "").split(/[;；、|\n]+/).map(item => item.trim()).filter(Boolean);
  }
  function distribution(items, accessor, labels) {
    const counts = new Map(labels.map(label => [label, 0]));
    items.forEach(item => [...new Set(accessor(item))].forEach(label => {
      if (counts.has(label)) counts.set(label, counts.get(label) + 1);
    }));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return { counts, total, share: label => total ? (counts.get(label) || 0) / total : 0 };
  }
  function sumTypes(types) { return Object.values(types || {}).reduce((a, b) => a + b, 0); }
  function aggregateTypes(items) {
    const result = Object.fromEntries(data.types.map(type => [type, 0]));
    items.forEach(item => data.types.forEach(type => { result[type] += item.types[type] || 0; }));
    return result;
  }
  function topType(types) {
    return Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  }
  function metric(label, value, suffix = "") {
    return `<div class="metric"><span>${label}</span><strong>${value}</strong>${suffix ? `<small>${suffix}</small>` : ""}</div>`;
  }
  function renderMetrics() {
    const worldTotal = data.world.countries.reduce((sum, item) => sum + item.value, 0);
    const worldLead = data.world.countries[0];
    document.getElementById("worldMetrics").innerHTML = [
      metric("独立专利族", fmt(data.meta.families), "FAMILIES"),
      metric("已识别国家 / 地区", fmt(data.meta.countryCount), "MARKETS"),
      metric("国家专利覆盖量", fmt(worldTotal), "COUNTRY–PATENT"),
      metric("领先国家", worldLead.name, `${fmt(worldLead.value)} 条`)
    ].join("");
    const leadProvince = data.china.provinces[0];
    const leadCity = data.china.cities[0];
    document.getElementById("chinaMetrics").innerHTML = [
      metric("中国去重专利", fmt(data.china.total), "FAMILIES"),
      metric("覆盖省级区域", fmt(data.meta.provinceCount), "REGIONS"),
      metric("省级高地", leadProvince.name, `${fmt(leadProvince.value)} 条`),
      metric("城市极点", leadCity.name, `${fmt(leadCity.value)} 条`)
    ].join("");
  }

  function initChart(id) {
    const chart = echarts.init(document.getElementById(id), null, { renderer: "canvas" });
    charts.push(chart);
    return chart;
  }

  const worldMap = initChart("worldMap");
  const worldTypeChart = initChart("worldTypeChart");
  const trendChart = initChart("trendChart");
  const chinaMap = initChart("chinaMap");
  const chinaTypeChart = initChart("chinaTypeChart");
  const chinaTypeTrendChart = initChart("chinaTypeTrendChart");
  const chinaTrendChart = initChart("chinaTrendChart");
  const institutionSankey = initChart("institutionSankey");
  const progressChart = initChart("progressChart");

  function typeChartOption(types, label) {
    const total = sumTypes(types);
    const entries = data.types.map(type => ({ name: type, value: types[type] || 0 })).filter(d => d.value > 0);
    return {
      animationDuration: 550,
      color: entries.map(d => TYPE_COLOR[d.name]),
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(21,35,55,.95)", borderWidth: 0, textStyle: { color: "#fff", fontSize: 11 },
        formatter: p => `${p.marker}${p.name}<br><b style="font-size:15px">${fmt(p.value)}</b> · ${p.percent}%`
      },
      title: [
        { text: compact.format(total), left: "center", top: "39%", textStyle: { color: "#152337", fontFamily: "monospace", fontSize: 22, fontWeight: 500 } },
        { text: label, left: "center", top: "54%", textStyle: { color: "#89939e", fontSize: 9, fontWeight: 400 } }
      ],
      series: [{
        type: "pie", radius: ["60%", "78%"], center: ["50%", "48%"], startAngle: 90,
        minAngle: 2, label: { show: false }, labelLine: { show: false },
        itemStyle: { borderColor: "#fbf8f3", borderWidth: 3 }, emphasis: { scaleSize: 5 }, data: entries
      }]
    };
  }

  function renderTypeList(elementId, types) {
    const total = sumTypes(types) || 1;
    const rows = data.types
      .map(type => ({ type, value: types[type] || 0 }))
      .sort((a, b) => b.value - a.value)
      .map(item => `<div class="type-row"><i style="background:${TYPE_COLOR[item.type]}"></i><span>${item.type}</span><b>${fmt(item.value)}</b><em>${(item.value / total * 100).toFixed(1)}%</em></div>`);
    document.getElementById(elementId).innerHTML = rows.join("");
  }

  const globalTypes = data.world.types || aggregateTypes(data.world.countries);
  function selectWorld(countryName = null) {
    const item = countryName ? countryByName.get(countryName) : null;
    const types = item?.types || globalTypes;
    const total = item?.value || data.world.total || data.meta.families;
    const rank = item ? String(data.world.countries.findIndex(d => d.name === item.name) + 1).padStart(2, "0") : "ALL";
    document.getElementById("worldSelected").textContent = item?.name || "全球";
    document.getElementById("worldSelectedCount").textContent = fmt(total);
    document.getElementById("worldRank").textContent = rank;
    worldTypeChart.setOption(typeChartOption(types, `${item?.name || "全球"} · 类型专利`), true);
    renderTypeList("worldTypeList", types);
  }

  const mapValues = data.world.countries.filter(d => d.mapName).map(d => ({ name: d.mapName, value: d.value, zhName: d.name }));
  const mapMax = Math.max(...mapValues.map(d => d.value));
  worldMap.setOption({
    animationDuration: 700,
    tooltip: {
      trigger: "item", confine: true, backgroundColor: "rgba(21,35,55,.95)", borderWidth: 0,
      padding: [11, 13], textStyle: { color: "#fff", fontSize: 11 },
      formatter: p => {
        const item = countryByMapName.get(p.name);
        return item ? `<span style="color:#f3aa2c">${item.name}</span><br><b style="font-size:16px">${fmt(item.value)}</b> 件去重专利` : `${p.name}<br><span style="color:#9fa9b4">暂无匹配记录</span>`;
      }
    },
    visualMap: {
      show: false, min: 1, max: mapMax, calculable: false,
      inRange: { color: ["#e7e1d8", "#f1b94b", "#e36a31", "#8c174f", "#391039"] }
    },
    series: [{
      type: "map", map: "world", roam: true, scaleLimit: { min: 1, max: 8 },
      left: "3%", right: "3%", top: "8%", bottom: "9%",
      itemStyle: { areaColor: "#e8e3dc", borderColor: "#fbf8f3", borderWidth: .7 },
      emphasis: { label: { show: false }, itemStyle: { areaColor: "#ffba4a", borderColor: "#fff", borderWidth: 1.1 } },
      select: { label: { show: false }, itemStyle: { areaColor: "#ed7b35" } },
      selectedMode: "single", data: mapValues
    }]
  });
  worldMap.on("click", params => {
    const item = countryByMapName.get(params.name);
    if (item) selectWorld(item.name);
  });
  document.getElementById("worldReset").addEventListener("click", () => {
    worldMap.dispatchAction({ type: "unselect", seriesIndex: 0 });
    worldMap.dispatchAction({ type: "restore" });
    selectWorld();
  });

  const defaultTrendNames = new Set(["美国", "中国", "日本", "欧盟（整体）", "英国", "韩国"]);
  const worldTrendByName = new Map(data.world.trends.map(item => [item.name, item]));
  let trendSelected = Object.fromEntries(data.world.trends.map(item => [item.name, defaultTrendNames.has(item.name)]));
  let trendRange = "all";
  function renderTrend() {
    const sourceYears = data.world.years;
    const selectedNames = Object.keys(trendSelected).filter(name => trendSelected[name]);
    const activeTrends = data.world.trends.filter(item => !selectedNames.length || selectedNames.includes(item.name));
    const firstRecordedIndex = sourceYears.findIndex((_year, index) => activeTrends.some(item => Number(item.values[index]) > 0));
    const baselineYear = firstRecordedIndex >= 0 ? Number(sourceYears[firstRecordedIndex]) - 1 : Number(sourceYears[0]);
    const existingBaselineIndex = sourceYears.findIndex(year => Number(year) === baselineYear);
    const prependBaseline = trendRange === "all" && firstRecordedIndex >= 0 && existingBaselineIndex < 0;
    const fullStartIndex = trendRange === "all" && firstRecordedIndex >= 0
      ? (existingBaselineIndex >= 0 ? existingBaselineIndex : firstRecordedIndex)
      : 0;
    const years = trendRange === "all"
      ? (prependBaseline ? [baselineYear, ...sourceYears.slice(fullStartIndex)] : sourceYears.slice(fullStartIndex))
      : sourceYears;
    const start = trendRange === "all" ? 0 : Math.max(0, years.length - Number(trendRange) - 1);
    const shownYears = years.slice(start);
    const latestYear = sourceYears[sourceYears.length - 1];
    const allSeries = data.world.trends.flatMap((item, index) => {
      const color = LINE_COLORS[index % LINE_COLORS.length];
      const expandedValues = trendRange === "all"
        ? (prependBaseline ? [0, ...item.values.slice(fullStartIndex)] : item.values.slice(fullStartIndex))
        : item.values;
      const values = expandedValues.slice(start);
      const lineData = values.map((value, i) => shownYears[i] === latestYear ? null : value);
      const barData = values.map((value, i) => shownYears[i] === latestYear ? value : null);
      return [
        {
          name: item.name, type: "line", data: lineData, symbol: "none", smooth: .16,
          lineStyle: { width: selectedNames.includes(item.name) ? 2.2 : 1.3 },
          emphasis: { focus: "series", lineStyle: { width: 3.2 } },
          itemStyle: { color },
          endLabel: { show: selectedNames.length <= 5 && selectedNames.includes(item.name), formatter: "{a}", color, fontSize: 9, distance: 6 },
          labelLayout: { moveOverlap: "shiftY" }
        },
        {
          name: item.name, type: "bar", data: barData, barMaxWidth: 11,
          itemStyle: { color, borderRadius: [2, 2, 0, 0], opacity: .88 },
          emphasis: { itemStyle: { opacity: 1, shadowBlur: 10, shadowColor: color } }
        }
      ];
    });
    trendChart.setOption({
      animationDuration: 500,
      color: LINE_COLORS,
      legend: {
        type: "scroll", top: 18, left: 24, right: 24, selected: trendSelected,
        itemWidth: 16, itemHeight: 2, itemGap: 18, icon: "rect",
        pageIconColor: "#e9632d", pageIconInactiveColor: "#c7c1b9", pageTextStyle: { color: "#718092", fontSize: 9 },
        textStyle: { color: "#5f6c7a", fontSize: 10 }
      },
      grid: { left: 60, right: 38, top: 73, bottom: 46 },
      tooltip: {
        trigger: "axis", order: "valueDesc", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 10 }, axisPointer: { type: "line", lineStyle: { color: "rgba(21,35,55,.22)" } },
        formatter: params => {
          const visible = params.filter(p => trendSelected[p.seriesName] && p.value != null).slice(0, 12);
          const axisValue = params[0]?.axisValue || "";
          return `<b style="display:block;margin-bottom:7px">${axisValue}${Number(axisValue) === latestYear ? " · YTD" : ""}</b>` + visible.map(p => `${p.marker}${p.seriesName}<b style="float:right;margin-left:20px">${fmt(p.value)}</b>`).join("<br>");
        }
      },
      xAxis: {
        type: "category", boundaryGap: true, data: shownYears,
        axisLine: { lineStyle: { color: "rgba(21,35,55,.16)" } }, axisTick: { show: false },
        axisLabel: { color: "#7d8894", fontSize: 9, interval: trendRange === "all" ? 14 : trendRange <= 10 ? 0 : 4, formatter: value => Number(value) === latestYear ? `${value}\nYTD` : value }
      },
      yAxis: {
        type: "value", name: "专利量", nameTextStyle: { color: "#8c96a0", fontSize: 9, padding: [0, 24, 8, 0] },
        axisLabel: { color: "#7d8894", fontSize: 9 }, splitNumber: 4,
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      series: allSeries
    }, true);
  }
  trendChart.on("legendselectchanged", event => {
    trendSelected = event.selected;
    renderTrend();
  });
  trendChart.on("click", event => {
    const latestYear = data.world.years[data.world.years.length - 1];
    if (event.seriesType === "bar" && Number(event.name) === latestYear) {
      const target = worldTrendByName.get(event.seriesName);
      if (target) openProgressModal(target.name, target.monthly, "国家 / 地区");
    }
  });
  document.querySelectorAll(".range-buttons button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".range-buttons button").forEach(b => b.classList.toggle("active", b === button));
    trendRange = button.dataset.range;
    renderTrend();
  }));

  const provinceMax = Math.max(...data.china.provinces.map(d => d.value));
  let selectedProvince = null;
  let selectedCity = null;
  let selectedOrganization = null;
  let cityQuery = "";
  let organizationFilter = "all";
  let chinaTrendRange = "all";
  let renderedOrganizations = [];
  let institutionPatents = [];
  let activePatentFilter = null;
  let patentQuery = "";
  let patentScope = "all";
  let regionCompareLevel = "province";
  const regionPatentCache = new Map();
  const cityProvinceByName = new Map();
  data.china.provinces.forEach(province => (province.cities || []).forEach(city => cityProvinceByName.set(city, province.name)));

  function regionCompareItems() {
    const items = regionCompareLevel === "province" ? data.china.provinces : data.china.cities;
    return [...items].sort((left, right) => Number(right.value || 0) - Number(left.value || 0) || left.name.localeCompare(right.name, "zh-CN"));
  }

  function regionCompareLabel(item) {
    if (regionCompareLevel === "province") return item.name;
    const province = cityProvinceByName.get(item.name);
    return province ? `${item.name} · ${province}` : item.name;
  }

  function compareRegionTypes(item) {
    if (regionCompareLevel === "province") return item.types || {};
    const result = Object.fromEntries(data.types.map(type => [type, 0]));
    (item.organizations || []).forEach(organization => {
      const type = data.types.includes(organization.type) ? organization.type : "待核验";
      result[type] = (result[type] || 0) + Number(organization.value || 0);
    });
    return result;
  }

  function compareRegionPatents(item) {
    const cacheKey = `${regionCompareLevel}:${item.name}`;
    if (regionPatentCache.has(cacheKey)) return regionPatentCache.get(cacheKey);
    let patents;
    if (regionCompareLevel === "province") {
      patents = chinaBenchmarkPatents.filter(patent => listValues(patent.provinces).includes(item.name));
    } else {
      const byFamily = new Map();
      (item.organizations || []).forEach(organization => {
        (data.china.organizationPatents?.[organization.name] || []).forEach(patent => {
          const id = patent.familyId || patent.id;
          if (id && !byFamily.has(id)) byFamily.set(id, patent);
        });
      });
      patents = [...byFamily.values()];
    }
    regionPatentCache.set(cacheKey, patents);
    return patents;
  }

  function compareChainValues(patents) {
    return distribution(patents, patent => listValues(patent.chain1).filter(label => CHAIN_LEVELS.includes(label)), CHAIN_LEVELS);
  }

  function compareTechValues(patents) {
    return distribution(patents, patent => listValues(patent.tech)
      .map(value => String(value).match(/\bB[1-9]\b/i)?.[0].toUpperCase() || "")
      .filter(code => TECH_CODES.includes(code)), TECH_CODES);
  }

  function comparisonSummary(item, side) {
    const recentFive = (item.trend || []).slice(-5).reduce((sum, value) => sum + Number(value || 0), 0);
    return `<section class="region-summary-card region-${side}">
      <div class="region-summary-title"><span>REGION ${side.toUpperCase()}</span><h4>${escapeHtml(regionCompareLabel(item))}</h4></div>
      <div class="region-summary-metrics">
        <div class="region-summary-metric"><span>全部专利族</span><strong>${fmt(item.value)}</strong></div>
        <div class="region-summary-metric"><span>核心专利</span><strong>${fmt(item.relevantValue)}</strong></div>
        <div class="region-summary-metric"><span>近 5 年公开</span><strong>${fmt(recentFive)}</strong></div>
        <div class="region-summary-metric"><span>创新主体</span><strong>${fmt((item.organizations || []).length)}</strong></div>
      </div>
    </section>`;
  }

  function comparisonPairRow(label, left, right, scale, formatter) {
    const leftWidth = Math.min(100, Math.max(0, left / scale * 100));
    const rightWidth = Math.min(100, Math.max(0, right / scale * 100));
    return `<div class="region-pair-row">
      <div class="region-pair-value left"><div class="region-pair-track"><i style="--w:${leftWidth.toFixed(2)}%"></i></div><b>${formatter(left)}</b></div>
      <span class="region-pair-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
      <div class="region-pair-value right"><b>${formatter(right)}</b><div class="region-pair-track"><i style="--w:${rightWidth.toFixed(2)}%"></i></div></div>
    </div>`;
  }

  function renderRegionComparison() {
    const items = regionCompareItems();
    const selectA = document.getElementById("regionCompareA");
    const selectB = document.getElementById("regionCompareB");
    const itemA = items.find(item => item.name === selectA.value) || items[0];
    const itemB = items.find(item => item.name === selectB.value) || items.find(item => item.name !== itemA?.name) || items[0];
    if (!itemA || !itemB) {
      document.getElementById("regionCompareBody").innerHTML = '<div class="empty-state">暂无可用于地区对比的数据</div>';
      return;
    }

    const patentsA = compareRegionPatents(itemA);
    const patentsB = compareRegionPatents(itemB);
    const chainA = compareChainValues(patentsA);
    const chainB = compareChainValues(patentsB);
    const regionChainColors = { 上游: "#315c79", 中游: "#e9632d", 下游: "#8c174f" };
    const chainCards = CHAIN_LEVELS.map(label => {
      const shareA = chainA.share(label);
      const shareB = chainB.share(label);
      const delta = shareA - shareB;
      return `<div class="region-chain-card" style="--chain-color:${regionChainColors[label]}">
        <span>${label}</span><strong class="${delta >= 0 ? "region-positive" : "region-negative"}">${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)}<small> pp</small></strong>
        <em>${escapeHtml(regionCompareLabel(itemA))} ${(shareA * 100).toFixed(1)}% · ${escapeHtml(regionCompareLabel(itemB))} ${(shareB * 100).toFixed(1)}%</em>
      </div>`;
    }).join("");

    const chain2Values = patent => listValues(patent.chain2).filter(label => label && label !== "不适用");
    const chain2Counts = new Map();
    [...patentsA, ...patentsB].forEach(patent => [...new Set(chain2Values(patent))].forEach(label => {
      chain2Counts.set(label, (chain2Counts.get(label) || 0) + 1);
    }));
    const chain2Labels = [...chain2Counts]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
      .slice(0, 8).map(item => item[0]);
    const chain2A = distribution(patentsA, chain2Values, chain2Labels);
    const chain2B = distribution(patentsB, chain2Values, chain2Labels);
    const chain2Gaps = chain2Labels.map(label => ({
      label, shareA: chain2A.share(label), shareB: chain2B.share(label)
    })).map(item => ({ ...item, delta: item.shareA - item.shareB }));
    const maxChain2Gap = Math.max(.001, ...chain2Gaps.map(item => Math.abs(item.delta)));
    const chain2Rows = chain2Gaps.map(item => {
      const positive = item.delta >= 0;
      const width = Math.max(2, Math.abs(item.delta) / maxChain2Gap * 50);
      return `<div class="region-gap-row" title="${escapeHtml(regionCompareLabel(itemA))} ${(item.shareA * 100).toFixed(1)}%；${escapeHtml(regionCompareLabel(itemB))} ${(item.shareB * 100).toFixed(1)}%">
        <span>${escapeHtml(item.label)}</span><div class="region-gap-track"><i></i><b class="${positive ? "positive" : "negative"}" style="--w:${width}%"></b></div>
        <strong class="${positive ? "region-positive" : "region-negative"}">${positive ? "+" : ""}${(item.delta * 100).toFixed(1)} pp</strong>
      </div>`;
    }).join("");

    const nationalTech = compareTechValues(chinaBenchmarkPatents);
    const techA = compareTechValues(patentsA);
    const techB = compareTechValues(patentsB);
    const techRta = (local, code) => nationalTech.share(code) ? local.share(code) / nationalTech.share(code) : 0;
    const techCell = (local, code, side) => {
      const value = techRta(local, code);
      const level = value >= 1.2 ? "strong" : value >= 1 ? "advantage" : value >= .8 ? "balanced" : "weak";
      return `<div class="region-rta-cell ${side} ${level}" title="RTA ${value.toFixed(2)}；${fmt(local.counts.get(code) || 0)} 个专利族">
        <strong>${value.toFixed(2)}</strong><small>${fmt(local.counts.get(code) || 0)} 个专利族</small></div>`;
    };
    const techRows = TECH_CODES.map(code => `<div class="region-rta-row">
      <div class="region-rta-route"><b>${code}</b><span>${escapeHtml(TECH_NAMES[code])}</span></div>
      ${techCell(techA, code, "region-a")}${techCell(techB, code, "region-b")}
    </div>`).join("");
    document.getElementById("regionCompareBody").innerHTML = `
      <div class="region-summary-grid">${comparisonSummary(itemA, "a")}${comparisonSummary(itemB, "b")}</div>
      <div class="region-benchmark-grid">
        <section class="region-benchmark-panel">
          <div class="region-benchmark-head"><div><span>RELATIVE TECHNOLOGY ADVANTAGE</span><h4>B1–B9 技术相对优势矩阵</h4></div><p>RTA = 本地区该路线占比 ÷ 中国该路线占比；<br>大于 1 表示超过全国平均水平。</p></div>
          <div class="region-advantage-matrix">
            <div class="region-rta-header"><span>技术路线</span><span>${escapeHtml(regionCompareLabel(itemA))}<br><small>${fmt(patentsA.length)} 个专利族</small></span><span>${escapeHtml(regionCompareLabel(itemB))}<br><small>${fmt(patentsB.length)} 个专利族</small></span></div>
            ${techRows}
          </div>
        </section>
        <section class="region-benchmark-panel">
          <div class="region-benchmark-head"><div><span>INDUSTRY CHAIN GAP</span><h4>产业链差值分析</h4></div></div>
          <div class="region-chain-gap-analysis">
            <div class="region-chain-cards">${chainCards}</div>
            <div class="region-gap-axis"><span>← ${escapeHtml(regionCompareLabel(itemB))}相对突出</span><b>产业二级占比差值 · 两地总量 TOP 8</b><span>${escapeHtml(regionCompareLabel(itemA))}相对突出 →</span></div>
            <div class="region-gap-list">${chain2Rows || '<div class="empty-state">暂无产业二级差值数据</div>'}</div>
          </div>
        </section>
      </div>`;
  }

  function populateRegionComparison(preferredA = null) {
    const items = regionCompareItems();
    const selectA = document.getElementById("regionCompareA");
    const selectB = document.getElementById("regionCompareB");
    const previousA = preferredA || selectA.value;
    const previousB = selectB.value;
    const options = items.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(regionCompareLabel(item))}</option>`).join("");
    selectA.innerHTML = options;
    selectB.innerHTML = options;
    selectA.value = items.some(item => item.name === previousA) ? previousA : items[0]?.name || "";
    selectB.value = items.some(item => item.name === previousB && item.name !== selectA.value)
      ? previousB
      : items.find(item => item.name !== selectA.value)?.name || selectA.value;
    renderRegionComparison();
  }

  function pillarRenderItem(params, api) {
    const point = api.coord([api.value(0), api.value(1)]);
    const value = api.value(2);
    const height = 14 + 78 * Math.sqrt(value / provinceMax);
    const width = 7 + 6 * Math.sqrt(value / provinceMax);
    const selected = api.value(4) === 1;
    return {
      type: "group",
      children: [
        { type: "ellipse", shape: { cx: point[0], cy: point[1] + 2, rx: width * 1.5, ry: width * .55 }, style: { fill: selected ? "rgba(233,99,45,.30)" : "rgba(57,16,57,.15)", shadowBlur: selected ? 18 : 9, shadowColor: selected ? "#e9632d" : "rgba(57,16,57,.25)" } },
        { type: "rect", shape: { x: point[0] - width / 2, y: point[1] - height, width, height, r: [width / 2, width / 2, 1, 1] }, style: { fill: new echarts.graphic.LinearGradient(0, 1, 0, 0, [{ offset: 0, color: "#f3aa2c" }, { offset: .42, color: "#e9632d" }, { offset: .74, color: "#8c174f" }, { offset: 1, color: "#311031" }]), shadowBlur: selected ? 18 : 5, shadowColor: selected ? "rgba(233,99,45,.8)" : "rgba(57,16,57,.26)", opacity: selected ? 1 : .9 } },
        { type: "ellipse", shape: { cx: point[0], cy: point[1] - height, rx: width / 2, ry: width * .2 }, style: { fill: selected ? "#fff0a6" : "#eac061" } }
      ]
    };
  }

  function chinaMapOption() {
    const pillarData = data.china.provinces
      .filter(d => PROVINCE_COORDS[d.name])
      .map(d => ({ name: d.name, value: [...PROVINCE_COORDS[d.name], d.value, d.name, d.name === selectedProvince ? 1 : 0] }));
    const labelData = data.china.provinces.slice(0, 12).filter(d => PROVINCE_COORDS[d.name]).map(d => ({ name: d.name, value: PROVINCE_COORDS[d.name] }));
    return {
      animationDuration: 650,
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "rgba(21,35,55,.95)", borderWidth: 0, padding: [11, 13],
        textStyle: { color: "#fff", fontSize: 11 },
        formatter: p => {
          const province = provinceByName.get(p.name);
          return province ? `<span style="color:#f3aa2c">${province.name}</span><br><b style="font-size:16px">${fmt(province.value)}</b> 件去重专利<br><span style="color:#aeb8c1">首要主体 · ${topType(province.types)}</span>` : p.name;
        }
      },
      geo: {
        map: "china", roam: true, zoom: 1.08, center: [104.3, 35.8], scaleLimit: { min: .85, max: 5 },
        left: "6%", right: "6%", top: "7%", bottom: "5%", silent: false,
        itemStyle: { areaColor: "#e7e0e5", borderColor: "#fffaf4", borderWidth: 1.1, shadowBlur: 6, shadowColor: "rgba(57,16,57,.06)" },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#dfd2dc" } },
        regions: data.china.provinces.map(d => ({ name: d.name, itemStyle: { areaColor: d.name === selectedProvince ? "#d9c1cc" : "#e7e0e5", borderColor: d.name === selectedProvince ? "#e9632d" : "#fffaf4", borderWidth: d.name === selectedProvince ? 1.8 : 1.1 } }))
      },
      series: [
        {
          name: "省级热力柱", type: "custom", coordinateSystem: "geo", renderItem: pillarRenderItem,
          encode: { tooltip: 2 }, data: pillarData, z: 4
        },
        {
          name: "重点省份", type: "scatter", coordinateSystem: "geo", symbolSize: 1, silent: true, z: 5,
          label: { show: true, position: "right", distance: 7, formatter: "{b}", color: "#293a4e", fontSize: 9, fontWeight: 600, textBorderColor: "rgba(255,253,249,.9)", textBorderWidth: 3 },
          data: labelData
        }
      ]
    };
  }

  function scopedCities() {
    const province = selectedProvince ? provinceByName.get(selectedProvince) : null;
    return province?.cities
      ? province.cities.map(name => cityByName.get(name)).filter(Boolean)
      : data.china.cities;
  }

  function renderCities() {
    const cities = scopedCities()
      .filter(item => item.name.includes(cityQuery))
      .sort((a, b) =>
        (Number(b.relevantValue) || 0) - (Number(a.relevantValue) || 0)
        || (Number(b.value) || 0) - (Number(a.value) || 0)
        || String(a.name).localeCompare(String(b.name), "zh-CN")
      );
    const max = Math.max(1, ...cities.map(item => item.relevantValue || 0));
    const list = document.getElementById("cityList");
    document.getElementById("cityScope").textContent = selectedProvince || "全国";
    if (!cities.length) {
      list.innerHTML = `<div class="empty-state">未找到匹配的城市</div>`;
      return;
    }
    list.innerHTML = cities.map((city, index) => `
      <div class="city-row${city.name === selectedCity ? " selected" : ""}" data-city="${city.name.replaceAll('"', '&quot;')}" role="button" tabindex="0" aria-label="查看${city.name}具体当前权利人">
        <div class="city-name"><b>${String(index + 1).padStart(2, "0")}</b><span>${city.name}</span></div>
        <div class="city-bar-track"><div class="city-bar" style="width:${((city.relevantValue || 0) / max * 100).toFixed(2)}%;min-width:${city.relevantValue ? 2 : 0}px;animation-delay:${Math.min(index, 12) * 25}ms"></div></div>
        <div class="city-value"><strong>${fmt(city.relevantValue || 0)}</strong><span>/</span>${fmt(city.value)}</div>
      </div>`).join("");
  }

  function scopedOrganizations() {
    if (selectedCity) return cityByName.get(selectedCity)?.organizations || [];
    if (selectedProvince) return provinceByName.get(selectedProvince)?.organizations || [];
    return data.china.organizations || [];
  }

  function renderChinaTypeTrend() {
    const organizations = scopedOrganizations();
    const years = data.china.years;
    const valuesByType = Object.fromEntries(data.types.map(type => [type, Array(years.length).fill(0)]));
    organizations.forEach(organization => {
      const type = data.types.includes(organization.type) ? organization.type : "待核验";
      const values = valuesByType[type] || valuesByType["待核验"];
      (organization.trend || []).forEach((value, index) => {
        if (index < values.length) values[index] += Number(value || 0);
      });
    });
    const activeTypes = data.types.filter(type => valuesByType[type].some(value => value > 0));
    const firstRecordedIndex = years.findIndex((_year, index) => activeTypes.some(type => valuesByType[type][index] > 0));
    const startIndex = Math.max(0, firstRecordedIndex > 0 ? firstRecordedIndex - 1 : firstRecordedIndex);
    const shownYears = years.slice(startIndex);
    const scope = currentRegionLabel();
    document.getElementById("chinaTypeTrendScope").textContent = scope;
    document.getElementById("chinaTypeTrendNote").textContent = `${scope} · ${fmt(organizations.length)} 个当前权利人 · 按权利人—专利族关联数堆叠`;
    chinaTypeTrendChart.setOption({
      animationDuration: 520,
      color: activeTypes.map(type => TYPE_COLOR[type]),
      legend: {
        type: "scroll", top: 14, left: 24, right: 24, itemWidth: 18, itemHeight: 8, itemGap: 22,
        textStyle: { color: "#526272", fontSize: 12 }, pageTextStyle: { color: "#65716d", fontSize: 11 }
      },
      grid: { left: 64, right: 32, top: 62, bottom: 54 },
      tooltip: {
        trigger: "axis", order: "valueDesc", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 }, axisPointer: { type: "line", lineStyle: { color: "rgba(21,35,55,.24)" } }
      },
      xAxis: {
        type: "category", boundaryGap: false, data: shownYears,
        axisLine: { lineStyle: { color: "rgba(21,35,55,.16)" } }, axisTick: { show: false },
        axisLabel: { color: "#687786", fontSize: 11, interval: shownYears.length > 70 ? 9 : shownYears.length > 35 ? 4 : 1 }
      },
      yAxis: {
        type: "value", minInterval: 1,
        axisLabel: { color: "#687786", fontSize: 11 }, splitNumber: 5,
        splitLine: { lineStyle: { color: "rgba(21,35,55,.075)", type: "dashed" } }
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", height: 14, bottom: 10, borderColor: "transparent", backgroundColor: "rgba(21,35,55,.05)", fillerColor: "rgba(233,99,45,.14)", handleStyle: { color: "#e9632d" }, textStyle: { fontSize: 10 } }
      ],
      series: activeTypes.map(type => ({
        name: type, type: "line", stack: "机构类型", data: valuesByType[type].slice(startIndex),
        smooth: .16, showSymbol: false, symbolSize: 5,
        lineStyle: { width: 1.8 }, areaStyle: { opacity: .34 }, emphasis: { focus: "series", lineStyle: { width: 3 } }
      }))
    }, true);
  }

  function currentRegionLabel() {
    return selectedCity || selectedProvince || "全国";
  }

  function renderOrganizations() {
    const organizations = scopedOrganizations();
    renderedOrganizations = organizationFilter === "enterprise"
      ? organizations.filter(item => item.type === "企业")
      : organizations;
    document.getElementById("orgScope").textContent = currentRegionLabel();
    const orgList = document.getElementById("orgList");
    orgList.innerHTML = renderedOrganizations.length ? renderedOrganizations.map((item, index) => `
      <div class="org-row${selectedOrganization?.name === item.name ? " selected" : ""}" data-org-index="${index}" role="button" tabindex="0" aria-label="查看${item.name}相关专利分析" title="${item.name.replaceAll('"', '&quot;')}">
        <b>${String(index + 1).padStart(2, "0")}</b>
        <div class="org-name"><strong>${item.name}</strong><span style="--type-color:${TYPE_COLOR[item.type]}">${item.type}</span></div>
        <div class="org-value"><strong>${fmt(item.relevantValue || 0)}</strong><span>/</span>${fmt(item.value)}</div>
      </div>`).join("") : `<div class="empty-state">当前地域暂无可识别的${organizationFilter === "enterprise" ? "企业权利人" : "当前权利人"}</div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function splitLabels(value) {
    return String(value || "").split(/[；;]+/).map(item => item.trim()).filter(Boolean);
  }

  function fieldLabels(patent, field) {
    return splitLabels(patent[field]);
  }

  function dominantLabel(patents, field) {
    const counts = new Map();
    patents.forEach(patent => fieldLabels(patent, field).forEach(label => counts.set(label, (counts.get(label) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "暂无标签";
  }

  function renderInstitutionMetrics() {
    const techCount = new Set(institutionPatents.flatMap(patent => fieldLabels(patent, "tech"))).size;
    const chain3Count = new Set(institutionPatents.flatMap(patent => fieldLabels(patent, "chain3"))).size;
    const latestDate = institutionPatents.map(patent => patent.date).filter(Boolean).sort().at(-1) || "—";
    const metrics = [
      { label: "相关去重专利", value: fmt(institutionPatents.length) },
      { label: "技术分类覆盖", value: fmt(techCount) },
      { label: "产业链三级标签", value: fmt(chain3Count) },
      { label: `最新公开 · ${latestDate}`, value: dominantLabel(institutionPatents, "tech"), text: true }
    ];
    document.getElementById("institutionMetrics").innerHTML = metrics.map(item => `
      <div class="institution-metric"><span>${escapeHtml(item.label)}</span><strong class="${item.text ? "text-value" : ""}" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</strong></div>`).join("");
  }

  function buildSankeyData(patents) {
    const levels = [
      { field: "tech", prefix: "T", color: "#8c174f", limit: 20, other: "其他技术分类" },
      { field: "chain1", prefix: "L1", color: "#e9632d", limit: 12, other: "其他一级标签" },
      { field: "chain2", prefix: "L2", color: "#315c79", limit: 24, other: "其他二级标签" },
      { field: "chain3", prefix: "L3", color: "#5a7a66", limit: 32, other: "其他三级标签" }
    ];
    const nodes = new Map();
    const links = new Map();
    const keptByField = new Map(levels.map(level => {
      const counts = new Map();
      patents.forEach(patent => fieldLabels(patent, level.field).forEach(label => counts.set(label, (counts.get(label) || 0) + 1)));
      return [level.field, new Set([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, level.limit).map(item => item[0]))];
    }));
    const valuesFor = (patent, level) => {
      const values = fieldLabels(patent, level.field);
      if (!values.length) return [""];
      return [...new Set(values.map(value => keptByField.get(level.field).has(value) ? value : "__OTHER__"))];
    };
    patents.forEach(patent => {
      const layerValues = levels.map(level => valuesFor(patent, level));
      layerValues.forEach((values, index) => values.forEach(raw => {
        const level = levels[index];
        const label = raw === "__OTHER__" ? level.other : raw || "未标注";
        const id = `${level.prefix}|${label}`;
        if (!nodes.has(id)) nodes.set(id, { name: id, label, raw, field: level.field, other: raw === "__OTHER__", kept: [...keptByField.get(level.field)], itemStyle: { color: level.color } });
      }));
      for (let index = 0; index < layerValues.length - 1; index += 1) {
        layerValues[index].forEach(sourceRaw => layerValues[index + 1].forEach(targetRaw => {
          const sourceLabel = sourceRaw === "__OTHER__" ? levels[index].other : sourceRaw || "未标注";
          const targetLabel = targetRaw === "__OTHER__" ? levels[index + 1].other : targetRaw || "未标注";
          const source = `${levels[index].prefix}|${sourceLabel}`;
          const target = `${levels[index + 1].prefix}|${targetLabel}`;
          const key = `${source}→${target}`;
          if (!links.has(key)) links.set(key, { source, target, patents: new Set() });
          links.get(key).patents.add(patent.id);
        }));
      }
    });
    return {
      nodes: [...nodes.values()],
      links: [...links.values()].map(link => ({ source: link.source, target: link.target, value: link.patents.size }))
    };
  }

  function renderInstitutionSankey() {
    const sankey = buildSankeyData(institutionPatents);
    institutionSankey.setOption({
      animationDuration: 600,
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: params => params.dataType === "edge"
          ? `${escapeHtml(params.data.source.split("|").slice(1).join("|"))}<br>→ ${escapeHtml(params.data.target.split("|").slice(1).join("|"))}<br><b>${fmt(params.value)}</b> 件专利`
          : `<b>${escapeHtml(params.data.label)}</b><br><span style="color:#f3aa2c">点击筛选专利列表</span>`
      },
      title: sankey.nodes.length ? undefined : { text: "暂无可用于分析的技术与产业链标签", left: "center", top: "middle", textStyle: { color: "#8a949e", fontSize: 14, fontWeight: 400 } },
      series: [{
        type: "sankey", left: 16, right: 122, top: 18, bottom: 18,
        nodeWidth: 11, nodeGap: 9, nodeAlign: "justify", draggable: true,
        data: sankey.nodes, links: sankey.links,
        label: { color: "#405164", fontSize: 10, width: 116, overflow: "truncate", formatter: params => params.data.label },
        lineStyle: { color: "gradient", opacity: .24, curveness: .52 },
        emphasis: { focus: "adjacency", lineStyle: { opacity: .58 } },
        levels: [{ depth: 0, itemStyle: { borderWidth: 0 } }, { depth: 1, itemStyle: { borderWidth: 0 } }, { depth: 2, itemStyle: { borderWidth: 0 } }, { depth: 3, itemStyle: { borderWidth: 0 } }]
      }]
    }, true);
  }

  function patentMatchesFilter(patent) {
    if (!activePatentFilter) return true;
    const values = fieldLabels(patent, activePatentFilter.field);
    if (activePatentFilter.other) return values.some(value => !activePatentFilter.kept.includes(value));
    return activePatentFilter.raw ? values.includes(activePatentFilter.raw) : values.length === 0;
  }

  function isCorePatent(patent) {
    return patent.core === true || String(patent.ipcSubclass || "").trim().toUpperCase() === "G21B";
  }

  function renderInstitutionPatentList() {
    const query = patentQuery.toLowerCase();
    const patents = institutionPatents.filter(patent => {
      if (patentScope === "core" && !isCorePatent(patent)) return false;
      if (!patentMatchesFilter(patent)) return false;
      if (!query) return true;
      return [patent.id, patent.title, patent.sao, patent.tech, patent.chain1, patent.chain2, patent.chain3].join(" ").toLowerCase().includes(query);
    });
    document.getElementById("patentCountLabel").textContent = `${fmt(patents.length)} / ${fmt(institutionPatents.length)} PATENTS`;
    document.querySelectorAll("#patentScopeFilter [data-patent-scope]").forEach(button => {
      const active = button.dataset.patentScope === patentScope;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const scopeLabel = patentScope === "core" ? "核心专利" : "全部专利";
    const tagLabel = activePatentFilter ? `已筛选 · ${activePatentFilter.label}` : "全部技术与产业链标签";
    document.getElementById("activePatentFilter").textContent = `${scopeLabel} · ${tagLabel}（${fmt(patents.length)} 件）`;
    document.getElementById("institutionPatentList").innerHTML = patents.length ? patents.map(patent => `
      <article class="patent-card">
        <div class="patent-card-head"><h4>${escapeHtml(patent.title || "未命名专利")}</h4><div class="patent-card-meta"><span>${escapeHtml(patent.id)}<br>${escapeHtml(patent.date || "日期未知")}</span>${isCorePatent(patent) ? '<b class="patent-core-star" title="核心专利：IPC主分类小类为 G21B" aria-label="核心专利">⭐</b>' : ""}</div></div>
        <p class="patent-sao"><b>技术特征</b> · ${escapeHtml(patent.sao || "暂无技术特征描述")}</p>
        <div class="patent-tags">
          <span class="patent-tag tech">技术分类 · ${escapeHtml(patent.tech || "未标注")}</span>
          <span class="patent-tag chain1">一级 · ${escapeHtml(patent.chain1 || "未标注")}</span>
          <span class="patent-tag chain2">二级 · ${escapeHtml(patent.chain2 || "未标注")}</span>
          <span class="patent-tag chain3">三级 · ${escapeHtml(patent.chain3 || "未标注")}</span>
        </div>
      </article>`).join("") : `<div class="empty-state">没有符合当前筛选条件的专利</div>`;
  }

  function showInstitutionBoard(organization) {
    institutionPatents = data.china.organizationPatents?.[organization.name] || [];
    activePatentFilter = null;
    patentQuery = "";
    patentScope = "all";
    document.getElementById("patentSearch").value = "";
    document.getElementById("institutionName").textContent = organization.name;
    document.getElementById("chinaTrendView").hidden = true;
    document.getElementById("institutionBoard").hidden = false;
    renderInstitutionMetrics();
    renderInstitutionSankey();
    renderInstitutionPatentList();
    requestAnimationFrame(() => institutionSankey.resize());
  }

  function showChinaTrendView() {
    document.getElementById("institutionBoard").hidden = true;
    document.getElementById("chinaTrendView").hidden = false;
    requestAnimationFrame(() => chinaTrendChart.resize());
  }

  function currentTrendTarget() {
    if (selectedOrganization) {
      return {
        label: selectedOrganization.name,
        path: `中国 · ${currentRegionLabel()} · ${selectedOrganization.name}`,
        values: selectedOrganization.trend,
        monthly: selectedOrganization.monthly,
        level: "机构"
      };
    }
    if (selectedCity) {
      const city = cityByName.get(selectedCity);
      return { label: city.name, path: `中国 · ${selectedProvince ? `${selectedProvince} · ` : ""}${city.name}`, values: city.trend, monthly: city.monthly, level: "城市" };
    }
    if (selectedProvince) {
      const province = provinceByName.get(selectedProvince);
      return { label: province.name, path: `中国 · ${province.name}`, values: province.trend, monthly: province.monthly, level: "省级区域" };
    }
    return { label: "中国", path: "中国 · 全国", values: data.china.trend, monthly: data.china.monthly, level: "国家" };
  }

  function renderChinaTrend() {
    const target = currentTrendTarget();
    const sourceYears = data.china.years;
    const firstRecordedIndex = target.values.findIndex(value => Number(value) > 0);
    const baselineYear = firstRecordedIndex >= 0 ? Number(sourceYears[firstRecordedIndex]) - 1 : Number(sourceYears[0]);
    const existingBaselineIndex = sourceYears.findIndex(year => Number(year) === baselineYear);
    const prependBaseline = chinaTrendRange === "all" && firstRecordedIndex >= 0 && existingBaselineIndex < 0;
    const fullStartIndex = chinaTrendRange === "all" && firstRecordedIndex >= 0
      ? (existingBaselineIndex >= 0 ? existingBaselineIndex : firstRecordedIndex)
      : 0;
    const years = chinaTrendRange === "all"
      ? (prependBaseline ? [baselineYear, ...sourceYears.slice(fullStartIndex)] : sourceYears.slice(fullStartIndex))
      : sourceYears;
    const start = chinaTrendRange === "all" ? 0 : Math.max(0, years.length - Number(chinaTrendRange) - 1);
    const shownYears = years.slice(start);
    const fullValues = chinaTrendRange === "all"
      ? (prependBaseline ? [0, ...target.values.slice(fullStartIndex)] : target.values.slice(fullStartIndex))
      : target.values;
    const shownValues = fullValues.slice(start);
    const latestYear = sourceYears[sourceYears.length - 1];
    const lineValues = shownValues.map((value, index) => shownYears[index] === latestYear ? null : value);
    const barValues = shownValues.map((value, index) => shownYears[index] === latestYear ? value : null);
    document.getElementById("chinaTrendScope").textContent = target.label;
    document.getElementById("chinaTrendPath").textContent = `${target.path} · ${target.level}`;
    chinaTrendChart.setOption({
      animationDuration: 500,
      grid: { left: 62, right: 34, top: 34, bottom: 45 },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 10 }, axisPointer: { type: "line", lineStyle: { color: "rgba(21,35,55,.24)" } },
        formatter: params => {
          const point = params.find(item => item.value != null) || params[0];
          return `<b style="display:block;margin-bottom:7px">${point?.axisValue || ""}</b>${point?.marker || ""}${target.label}<b style="float:right;margin-left:24px">${fmt(point?.value)} 件</b>`;
        }
      },
      xAxis: {
        type: "category", boundaryGap: true, data: shownYears,
        axisLine: { lineStyle: { color: "rgba(21,35,55,.16)" } }, axisTick: { show: false },
        axisLabel: { color: "#7d8894", fontSize: 9, interval: chinaTrendRange === "all" ? 14 : chinaTrendRange <= 10 ? 0 : 4, formatter: value => Number(value) === latestYear ? `${value}\nYTD` : value }
      },
      yAxis: {
        type: "value", minInterval: 1, name: "去重专利量",
        nameTextStyle: { color: "#8c96a0", fontSize: 9, padding: [0, 22, 8, 0] },
        axisLabel: { color: "#7d8894", fontSize: 9 }, splitNumber: 4,
        splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      series: [
        {
          name: target.label, type: "line", data: lineValues, symbol: "circle", symbolSize: 4,
          showSymbol: shownYears.length <= 20, smooth: .18,
          lineStyle: { width: 2.5, color: "#8c174f" }, itemStyle: { color: "#e9632d", borderColor: "#fff", borderWidth: 1 },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(140,23,79,.24)" }, { offset: 1, color: "rgba(233,99,45,.015)" }]) },
          markPoint: { symbol: "circle", symbolSize: 28, label: { color: "#fff", fontSize: 8 }, data: [{ type: "max", name: "峰值" }] }
        },
        {
          name: target.label, type: "bar", data: barValues, barMaxWidth: 30,
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#8c174f" }, { offset: 1, color: "#e9632d" }]), borderRadius: [3, 3, 0, 0] },
          label: { show: true, position: "top", color: "#8c174f", fontSize: 9, formatter: p => p.value == null ? "" : `${p.value} · YTD` },
          emphasis: { itemStyle: { shadowBlur: 14, shadowColor: "rgba(140,23,79,.38)" } }
        }
      ]
    }, true);
  }

  chinaTrendChart.on("click", event => {
    const latestYear = data.china.years[data.china.years.length - 1];
    if (event.seriesType === "bar" && Number(event.name) === latestYear) {
      const target = currentTrendTarget();
      openProgressModal(target.label, target.monthly, target.level);
    }
  });

  function openProgressModal(label, monthly, level) {
    if (!monthly) return;
    const years = Object.keys(monthly).map(Number).sort((a, b) => a - b);
    const latestYear = years[years.length - 1];
    const previousYear = years[years.length - 2];
    const cutoffParts = String(data.meta.dataCutoff || `${latestYear}-12-31`).split("-").map(Number);
    const cutoffMonth = cutoffParts[0] === latestYear ? Math.max(1, Math.min(12, cutoffParts[1])) : 12;
    const latestValue = monthly[String(latestYear)]?.[cutoffMonth - 1] || 0;
    const previousValue = monthly[String(previousYear)]?.[cutoffMonth - 1] || 0;
    const change = previousValue ? (latestValue - previousValue) / previousValue * 100 : null;
    document.getElementById("progressTitle").textContent = `${label} · 年度累计进度`;
    document.getElementById("progressSubtitle").textContent = `${level}｜数据截至 ${data.meta.dataCutoff || "—"}｜点击对象的月度累计去重专利`;
    document.getElementById("progressStats").innerHTML = [
      { label: `${latestYear} YTD`, value: fmt(latestValue), note: `截至 ${cutoffMonth} 月` },
      { label: `${previousYear} 同期`, value: fmt(previousValue), note: `截至 ${cutoffMonth} 月` },
      { label: "同比变化", value: change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, note: `${latestYear} / ${previousYear}` }
    ].map(item => `<div class="progress-stat"><span>${item.label}</span><strong>${item.value}</strong><em>${item.note}</em></div>`).join("");

    const seriesColors = ["#315c79", "#e9632d", "#8c174f"];
    progressChart.setOption({
      animationDuration: 550,
      color: seriesColors,
      legend: { top: 16, right: 28, itemWidth: 18, itemHeight: 3, icon: "rect", textStyle: { color: "#657382", fontSize: 10 } },
      grid: { left: 66, right: 34, top: 62, bottom: 48 },
      tooltip: {
        trigger: "axis", order: "valueDesc", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 10 },
        formatter: params => `<b style="display:block;margin-bottom:7px">${params[0]?.axisValue || ""}</b>` + params.filter(p => p.value != null).map(p => `${p.marker}${p.seriesName}<b style="float:right;margin-left:24px">${fmt(p.value)}</b>`).join("<br>")
      },
      xAxis: {
        type: "category", boundaryGap: false, data: ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],
        axisTick: { show: false }, axisLine: { lineStyle: { color: "rgba(21,35,55,.16)" } }, axisLabel: { color: "#76828e", fontSize: 9 }
      },
      yAxis: {
        type: "value", minInterval: 1, name: "累计去重专利量", nameTextStyle: { color: "#8c96a0", fontSize: 9, padding: [0,20,8,0] },
        axisLabel: { color: "#76828e", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(21,35,55,.07)", type: "dashed" } }
      },
      series: years.map((year, index) => ({
        name: String(year), type: "line",
        data: monthly[String(year)].map((value, monthIndex) => year === latestYear && monthIndex >= cutoffMonth ? null : value),
        smooth: .2, symbol: "circle", symbolSize: year === latestYear ? 6 : 4,
        lineStyle: { width: year === latestYear ? 3 : 1.7, type: year === latestYear ? "solid" : "dashed" },
        itemStyle: { color: seriesColors[index], borderColor: "#fff", borderWidth: 1 },
        emphasis: { focus: "series" }
      }))
    }, true);
    const modal = document.getElementById("progressModal");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => progressChart.resize());
  }

  function closeProgressModal() {
    document.getElementById("progressModal").hidden = true;
    document.body.style.overflow = "";
  }

  document.getElementById("progressClose").addEventListener("click", closeProgressModal);
  document.getElementById("progressModal").addEventListener("click", event => {
    if (event.target.id === "progressModal") closeProgressModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("progressModal").hidden) closeProgressModal();
  });

  function selectCity(name) {
    if (!cityByName.has(name)) return;
    selectedCity = name;
    selectedOrganization = null;
    document.querySelectorAll(".city-row").forEach(row => row.classList.toggle("selected", row.dataset.city === name));
    renderOrganizations();
    showChinaTrendView();
    renderChinaTrend();
    renderChinaTypeTrend();
    if (regionCompareLevel === "city") populateRegionComparison(name);
  }

  function selectOrganizationByIndex(index) {
    const organization = renderedOrganizations[index];
    if (!organization) return;
    selectedOrganization = organization;
    document.querySelectorAll(".org-row").forEach(row => row.classList.toggle("selected", Number(row.dataset.orgIndex) === index));
    showInstitutionBoard(organization);
  }

  function selectProvince(name = null, rerenderMap = true) {
    const province = name ? provinceByName.get(name) : null;
    selectedProvince = province?.name || null;
    selectedCity = null;
    selectedOrganization = null;
    cityQuery = "";
    document.getElementById("citySearch").value = "";
    const types = province?.types || data.china.types;
    const rank = province ? String(data.china.provinces.findIndex(d => d.name === province.name) + 1).padStart(2, "0") : "ALL";
    document.getElementById("provinceSelected").textContent = province?.name || "全国";
    document.getElementById("provinceSelectedCount").textContent = fmt(province?.value || data.china.total);
    document.getElementById("provinceRank").textContent = rank;
    chinaTypeChart.setOption(typeChartOption(types, `${province?.name || "全国"} · 类型专利`), true);
    renderTypeList("chinaTypeList", types);
    renderCities();
    renderOrganizations();
    showChinaTrendView();
    renderChinaTrend();
    renderChinaTypeTrend();
    if (selectedProvince && regionCompareLevel === "province") populateRegionComparison(selectedProvince);
    if (rerenderMap) chinaMap.setOption(chinaMapOption(), true);
  }

  populateRegionComparison();
  chinaMap.setOption(chinaMapOption(), true);
  chinaMap.on("click", params => {
    const name = provinceByName.has(params.name) ? params.name : params.data?.name;
    if (provinceByName.has(name)) selectProvince(name);
  });
  document.getElementById("chinaReset").addEventListener("click", () => selectProvince());
  document.getElementById("regionCompareLevel").addEventListener("click", event => {
    const button = event.target.closest("button[data-region-level]");
    if (!button || button.dataset.regionLevel === regionCompareLevel) return;
    regionCompareLevel = button.dataset.regionLevel;
    document.querySelectorAll("#regionCompareLevel button").forEach(item => item.classList.toggle("active", item === button));
    populateRegionComparison(regionCompareLevel === "province" ? selectedProvince : selectedCity);
  });
  ["regionCompareA", "regionCompareB"].forEach(id => document.getElementById(id).addEventListener("change", event => {
    const selectA = document.getElementById("regionCompareA");
    const selectB = document.getElementById("regionCompareB");
    if (selectA.value === selectB.value) {
      const other = event.currentTarget === selectA ? selectB : selectA;
      const alternative = regionCompareItems().find(item => item.name !== event.currentTarget.value);
      if (alternative) other.value = alternative.name;
    }
    renderRegionComparison();
  }));
  document.getElementById("citySearch").addEventListener("input", event => {
    cityQuery = event.target.value.trim();
    renderCities();
  });
  document.getElementById("cityList").addEventListener("click", event => {
    const row = event.target.closest(".city-row");
    if (row) selectCity(row.dataset.city);
  });
  document.getElementById("cityList").addEventListener("keydown", event => {
    const row = event.target.closest(".city-row");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectCity(row.dataset.city);
    }
  });
  document.getElementById("orgList").addEventListener("click", event => {
    const row = event.target.closest(".org-row");
    if (row) selectOrganizationByIndex(Number(row.dataset.orgIndex));
  });
  document.getElementById("orgList").addEventListener("keydown", event => {
    const row = event.target.closest(".org-row");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectOrganizationByIndex(Number(row.dataset.orgIndex));
    }
  });
  document.getElementById("orgFilter").addEventListener("click", event => {
    const button = event.target.closest("button[data-org-filter]");
    if (!button || button.dataset.orgFilter === organizationFilter) return;
    organizationFilter = button.dataset.orgFilter;
    selectedOrganization = null;
    document.querySelectorAll("#orgFilter button").forEach(item => item.classList.toggle("active", item === button));
    renderOrganizations();
    showChinaTrendView();
    renderChinaTrend();
  });
  institutionSankey.on("click", event => {
    if (event.dataType !== "node") return;
    activePatentFilter = { field: event.data.field, raw: event.data.raw, label: event.data.label, other: event.data.other, kept: event.data.kept || [] };
    renderInstitutionPatentList();
  });
  document.getElementById("sankeyReset").addEventListener("click", () => {
    activePatentFilter = null;
    renderInstitutionPatentList();
  });
  document.getElementById("patentSearch").addEventListener("input", event => {
    patentQuery = event.target.value.trim();
    renderInstitutionPatentList();
  });
  document.getElementById("patentScopeFilter").addEventListener("click", event => {
    const button = event.target.closest("button[data-patent-scope]");
    if (!button || button.dataset.patentScope === patentScope) return;
    patentScope = button.dataset.patentScope;
    renderInstitutionPatentList();
  });
  document.getElementById("institutionBack").addEventListener("click", () => {
    selectedOrganization = null;
    document.querySelectorAll(".org-row").forEach(row => row.classList.remove("selected"));
    showChinaTrendView();
    renderChinaTrend();
  });
  document.querySelectorAll(".china-range-buttons button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".china-range-buttons button").forEach(item => item.classList.toggle("active", item === button));
    chinaTrendRange = button.dataset.chinaRange;
    renderChinaTrend();
  }));

  document.querySelectorAll(".nav-button").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.view;
    document.querySelectorAll(".nav-button").forEach(b => b.classList.toggle("active", b === button));
    document.querySelectorAll(".view-panel").forEach(panel => panel.classList.toggle("active", panel.id === `${target}View`));
    requestAnimationFrame(() => charts.forEach(chart => chart.resize()));
  }));

  const generated = new Date(data.meta.generated);
  document.getElementById("generatedAt").textContent = `${generated.getFullYear()}.${String(generated.getMonth() + 1).padStart(2, "0")}.${String(generated.getDate()).padStart(2, "0")}`;

  const activeModule = document.documentElement.dataset.module || "legacy";
  if (activeModule === "china") {
    selectProvince(null, false);
  } else if (activeModule !== "enterprise") {
    renderMetrics();
    selectWorld();
    renderTrend();
    selectProvince(null, false);
  }

  let resizeFrame;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => charts.forEach(chart => chart.resize()));
  });
})();
