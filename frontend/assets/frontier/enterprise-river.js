(() => {
  "use strict";

  const index = window.FRONTIER_ENTERPRISE_INDEX;
  const root = document.getElementById("enterpriseRiverPanel");
  if (!root) return;

  const state = {
    topicId: Number(document.documentElement.dataset.frontierTopicId || 0),
    limit: 30,
    scope: "recent",
    longTailPage: 0
  };
  const nf = new Intl.NumberFormat("zh-CN");
  const displayEnterpriseName = window.FUSION_ENTERPRISE_NAME?.display || (value => String(value || ""));
  const YEAR_NOW = new Date().getFullYear();
  const CHAIN_ORDER = ["上游", "中游", "下游"];
  const CHAIN_CLASS = { "上游": "upstream", "中游": "midstream", "下游": "downstream" };
  const OTHER_COMPANY = "其他企业";

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const escapeAttr = escapeHtml;
  const shortText = (value, max = 24) => {
    const text = String(value || "").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };
  const patentYear = patent => {
    const match = String(patent.date || "").match(/(?:19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  function openEnterpriseProfile(name) {
    if (!name) return;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "fusion:open-enterprise", company: name }, "*");
      return;
    }
    location.href = `enterprise.html?company=${encodeURIComponent(name)}&from=frontier`;
  }

  function timeBands(years) {
    if (state.scope === "recent") {
      const start = YEAR_NOW - 19;
      return Array.from({ length: 20 }, (_, offset) => {
        const year = start + offset;
        return { from: year, to: year, label: String(year) };
      });
    }
    const min = Math.min(...years);
    const max = Math.max(...years);
    const span = Math.max(1, max - min + 1);
    const step = Math.max(1, Math.ceil(span / 12));
    const bands = [];
    for (let from = min; from <= max; from += step) {
      const to = Math.min(max, from + step - 1);
      bands.push({ from, to, label: from === to ? String(from) : `${from}-${to}` });
    }
    return bands;
  }

  function buildGraph(topic) {
    const eligibleCompanies = topic.companies.filter(company =>
      company.country === "中国" && String(company.type || "").trim() !== "个人"
    );
    const eligible = new Set(eligibleCompanies.map(company => company.name));
    const years = topic.patents.map(patentYear).filter(Number.isFinite);
    if (!years.length) return null;
    const bands = timeBands(years);
    const sourceRecords = [];
    const chainGroupByName = new Map();

    topic.patents.forEach(patent => {
      const year = patentYear(patent);
      if (!Number.isFinite(year)) return;
      const band = bands.find(item => year >= item.from && year <= item.to);
      if (!band) return;
      const chain = patent.chainLevel2;
      const chainGroup = patent.chainLevel1;
      if (!chain || chain === "不适用" || !CHAIN_ORDER.includes(chainGroup)) return;
      chainGroupByName.set(chain, chainGroup);
      const patentCompanies = new Set();
      (patent.owners || []).forEach(owner => {
        if (!owner.company || !eligible.has(owner.company)) return;
        patentCompanies.add(owner.company);
      });
      patentCompanies.forEach(company => sourceRecords.push({
        band: band.label,
        company,
        chain,
        chainGroup,
        familyId: patent.familyId,
        title: patent.title
      }));
    });
    if (!sourceRecords.length) return null;

    const companyTotals = new Map();
    sourceRecords.forEach(record => companyTotals.set(record.company, (companyTotals.get(record.company) || 0) + 1));
    const rankedCompanies = [...companyTotals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
    const hiddenCompanies = rankedCompanies.slice(state.limit);
    const hiddenNames = new Set(hiddenCompanies.map(([name]) => name));
    const longTailPageCount = Math.ceil(hiddenCompanies.length / state.limit);
    const longTailPage = longTailPageCount
      ? Math.min(Math.max(0, state.longTailPage), longTailPageCount)
      : 0;
    if (state.longTailPage !== longTailPage) state.longTailPage = longTailPage;
    const pageStartIndex = state.limit + Math.max(0, longTailPage - 1) * state.limit;
    const rankedNames = (longTailPage
      ? rankedCompanies.slice(pageStartIndex, pageStartIndex + state.limit)
      : rankedCompanies.slice(0, state.limit)
    ).map(([name]) => name);
    const selected = new Set(rankedNames);
    const hasOther = !longTailPage && hiddenCompanies.length > 0;
    const hiddenRecords = sourceRecords.filter(record => hiddenNames.has(record.company));
    const records = longTailPage
      ? sourceRecords.filter(record => selected.has(record.company))
      : sourceRecords.map(record => ({
          ...record,
          company: selected.has(record.company) ? record.company : OTHER_COMPANY
        }));

    const aggregate = (sourceKey, targetKey) => {
      const map = new Map();
      records.forEach(record => {
        const source = record[sourceKey];
        const target = record[targetKey];
        const key = `${source}\u0000${target}`;
        const item = map.get(key) || { source, target, count: 0, families: new Set(), samples: [] };
        item.count += 1;
        item.families.add(record.familyId);
        if (item.samples.length < 3 && !item.samples.includes(record.title)) item.samples.push(record.title);
        map.set(key, item);
      });
      return [...map.values()].map(item => ({ ...item, familyCount: item.families.size }));
    };

    const firstLinks = aggregate("band", "company");
    const secondLinks = aggregate("company", "chain");
    const bandNames = bands.map(band => band.label).reverse();
    const companyNames = [...rankedNames, ...(hasOther ? [OTHER_COMPANY] : [])]
      .filter(name => records.some(record => record.company === name));
    const nodeTotals = (names, key) => names.map(name => ({
      id: name,
      count: records.filter(record => record[key] === name).length
    }));
    const chainNames = [...new Set(records.map(record => record.chain))].sort((a, b) => {
      const groupDiff = CHAIN_ORDER.indexOf(chainGroupByName.get(a)) - CHAIN_ORDER.indexOf(chainGroupByName.get(b));
      const countDiff = records.filter(record => record.chain === b).length - records.filter(record => record.chain === a).length;
      return groupDiff || countDiff || a.localeCompare(b, "zh-CN");
    });
    return {
      records,
      bands: nodeTotals(bandNames, "band"),
      companies: nodeTotals(companyNames, "company"),
      chains: nodeTotals(chainNames, "chain").map(node => ({ ...node, group: chainGroupByName.get(node.id) })),
      firstLinks,
      secondLinks,
      mappedFamilies: new Set(records.map(record => record.familyId)).size,
      sourceCompanyCount: companyTotals.size,
      chainMetricCount: chainNames.length,
      chainGroupByName,
      detailMode: longTailPage > 0,
      longTailPage,
      longTailPageCount,
      pageStartRank: longTailPage ? pageStartIndex + 1 : 1,
      pageEndRank: longTailPage ? pageStartIndex + rankedNames.length : Math.min(state.limit, companyTotals.size),
      visibleCompanyCount: rankedNames.length,
      hiddenCompanyCount: hiddenCompanies.length,
      hiddenRelationCount: hiddenRecords.length,
      hiddenRelationShare: sourceRecords.length ? hiddenRecords.length / sourceRecords.length : 0,
      totalRelationCount: sourceRecords.length,
      totalMappedFamilies: new Set(sourceRecords.map(record => record.familyId)).size
    };
  }

  function layoutColumn(nodes, x, scale, gap, top) {
    let y = top;
    return nodes.map(node => {
      const height = Math.max(5, node.count * scale);
      const laidOut = { ...node, x, y, height, linkHeight: node.count * scale, offsetOut: 0, offsetIn: 0 };
      y += height + gap;
      return laidOut;
    });
  }

  function bandPath(source, target, thickness, sourceOffset, targetOffset) {
    const sx = source.x + 12;
    const tx = target.x;
    const sy0 = source.y + (source.height - source.linkHeight) / 2 + sourceOffset;
    const ty0 = target.y + (target.height - target.linkHeight) / 2 + targetOffset;
    const sy1 = sy0 + thickness;
    const ty1 = ty0 + thickness;
    const mx = (sx + tx) / 2;
    return `M${sx},${sy0} C${mx},${sy0} ${mx},${ty0} ${tx},${ty0} L${tx},${ty1} C${mx},${ty1} ${mx},${sy1} ${sx},${sy1} Z`;
  }

  function renderSvg(graph) {
    const width = 900;
    const top = 48;
    const bottom = 30;
    const gap = 9;
    const maxNodes = Math.max(graph.bands.length, graph.companies.length, graph.chains.length);
    const height = Math.max(780, top + bottom + maxNodes * 32);
    const total = graph.records.length;
    const scaleFor = count => (height - top - bottom - Math.max(0, count - 1) * gap) / Math.max(1, total);
    const scale = Math.max(.7, Math.min(12, scaleFor(graph.bands.length), scaleFor(graph.companies.length), scaleFor(graph.chains.length)));
    const bands = layoutColumn(graph.bands, 28, scale, gap, top);
    const companies = layoutColumn(graph.companies, 306, scale, gap, top);
    const chains = layoutColumn(graph.chains, 620, scale, gap, top);
    const bandById = new Map(bands.map(node => [node.id, node]));
    const companyById = new Map(companies.map(node => [node.id, node]));
    const chainById = new Map(chains.map(node => [node.id, node]));
    const companyIds = new Map(companies.map((node, position) => [node.id, `company-${position}`]));
    const bandIds = new Map(bands.map((node, position) => [node.id, `band-${position}`]));
    const chainIds = new Map(chains.map((node, position) => [node.id, `chain-${position}`]));
    const firstLinkChains = new Map();
    const secondLinkBands = new Map();
    const relationKey = (source, target) => `${source}\u0000${target}`;
    graph.records.forEach(record => {
      const bandId = bandIds.get(record.band);
      const chainId = chainIds.get(record.chain);
      const firstKey = relationKey(record.band, record.company);
      const secondKey = relationKey(record.company, record.chain);
      if (!firstLinkChains.has(firstKey)) firstLinkChains.set(firstKey, new Set());
      if (!secondLinkBands.has(secondKey)) secondLinkBands.set(secondKey, new Set());
      if (chainId) firstLinkChains.get(firstKey).add(chainId);
      if (bandId) secondLinkBands.get(secondKey).add(bandId);
    });
    const companyDisplayName = name => name === OTHER_COMPANY
      ? `其他企业（${nf.format(graph.hiddenCompanyCount)}家，点击展开）`
      : displayEnterpriseName(name);

    const links = [];
    [...graph.firstLinks].sort((a, b) => (bandById.get(a.source)?.y || 0) - (bandById.get(b.source)?.y || 0) || (companyById.get(a.target)?.y || 0) - (companyById.get(b.target)?.y || 0)).forEach(link => {
      const source = bandById.get(link.source);
      const target = companyById.get(link.target);
      if (!source || !target) return;
      const thickness = link.count * scale;
      const companyId = companyIds.get(link.target) || "company-other";
      const bandId = bandIds.get(link.source) || "";
      const relatedChainIds = [...(firstLinkChains.get(relationKey(link.source, link.target)) || [])].join(" ");
      const tip = `${link.source} → ${companyDisplayName(link.target)}|${nf.format(link.familyCount)} 个专利族`;
      links.push(`<path class="river-link river-link-secondary" d="${bandPath(source, target, thickness, source.offsetOut, target.offsetIn)}" data-company-ids="${companyId}" data-band-id="${bandId}" data-chain-ids="${relatedChainIds}" data-river-tip="${escapeAttr(tip)}"></path>`);
      source.offsetOut += thickness;
      target.offsetIn += thickness;
    });
    [...graph.secondLinks].sort((a, b) => (companyById.get(a.source)?.y || 0) - (companyById.get(b.source)?.y || 0) || (chainById.get(a.target)?.y || 0) - (chainById.get(b.target)?.y || 0)).forEach(link => {
      const source = companyById.get(link.source);
      const target = chainById.get(link.target);
      if (!source || !target) return;
      const thickness = link.count * scale;
      const companyId = companyIds.get(link.source) || "company-other";
      const chainId = chainIds.get(link.target) || "";
      const relatedBandIds = [...(secondLinkBands.get(relationKey(link.source, link.target)) || [])].join(" ");
      const samples = link.samples.map(title => shortText(title, 48)).join("；");
      const chainGroup = graph.chainGroupByName.get(link.target);
      const chainClass = CHAIN_CLASS[chainGroup] || "midstream";
      const groupedTip = `${companyDisplayName(link.source)} → ${link.target}（${chainGroup}）|${nf.format(link.familyCount)} 个专利族${samples ? `|代表专利：${samples}` : ""}`;
      links.push(`<path class="river-link river-link-chain-${chainClass}" d="${bandPath(source, target, thickness, source.offsetOut, target.offsetIn)}" data-company-ids="${companyId}" data-chain-id="${chainId}" data-band-ids="${relatedBandIds}" data-river-tip="${escapeAttr(groupedTip)}"></path>`);
      source.offsetOut += thickness;
      target.offsetIn += thickness;
    });

    const nodeMarkup = (nodes, type) => nodes.map((node, position) => {
      const isOther = node.id === OTHER_COMPANY;
      const rectClass = isOther ? "river-node-other" : `river-node-${type}`;
      const labelX = node.x + 18;
      const labelY = node.y + node.height / 2 + 3.5;
      if (type === "company") {
        const companyId = companyIds.get(node.id) || `company-${position}`;
        const canDrillDown = isOther && !graph.detailMode && graph.hiddenCompanyCount > 0;
        const visibleName = companyDisplayName(node.id);
        const relationShare = `${(graph.hiddenRelationShare * 100).toFixed(1)}%`;
        const ariaLabel = canDrillDown
          ? `其他企业，${graph.hiddenCompanyCount}家机构，${graph.hiddenRelationCount}条专利族关系，占全部关系${relationShare}，点击分页查看`
          : `${visibleName}，${node.count} 个企业专利族关系，打开企业画像`;
        const title = canDrillDown
          ? `${visibleName}：${nf.format(graph.hiddenRelationCount)}条专利族关系，占${relationShare}`
          : visibleName;
        const drillAttributes = canDrillDown
          ? ` data-river-action="drilldown" data-river-tip="${escapeAttr(`其他企业|隐藏 ${nf.format(graph.hiddenCompanyCount)} 家机构|${nf.format(graph.hiddenRelationCount)} 条专利族关系，占 ${relationShare}|点击分页查看企业`)}"`
          : "";
        return `<g class="river-company-node" data-company-id="${companyId}" data-company-name="${escapeAttr(node.id)}" data-river-disabled="false" role="button" tabindex="0"${drillAttributes} aria-label="${escapeAttr(ariaLabel)}"><title>${escapeHtml(title)}</title><rect class="river-node-rect ${rectClass}" x="${node.x}" y="${node.y}" width="12" height="${node.height}"></rect><text class="river-node-label" x="${labelX}" y="${labelY}">${escapeHtml(shortText(visibleName, 28))}</text></g>`;
      }
      if (type === "chain") {
        const chainClass = CHAIN_CLASS[node.group] || "midstream";
        const chainId = chainIds.get(node.id) || `chain-${position}`;
        return `<g class="river-filter-node river-chain-node" data-chain-id="${chainId}" role="button" tabindex="0" aria-label="高亮${escapeAttr(node.id)}的全部关联路径"><title>${escapeHtml(`${node.id}（${node.group}）`)}</title><rect class="river-node-rect river-node-chain river-node-chain-${chainClass}" x="${node.x}" y="${node.y}" width="12" height="${node.height}"></rect><text class="river-node-label river-chain-label" x="${labelX}" y="${labelY}">${escapeHtml(shortText(node.id, 20))}</text><text class="river-node-count" x="884" y="${labelY}">${nf.format(node.count)}</text></g>`;
      }
      const bandId = bandIds.get(node.id) || `band-${position}`;
      return `<g class="river-filter-node river-time-node" data-band-id="${bandId}" role="button" tabindex="0" aria-label="高亮${escapeAttr(node.id)}的全部关联路径"><title>${escapeHtml(`${node.id}：${nf.format(node.count)}条专利族关系`)}</title><rect class="river-node-rect ${rectClass}" x="${node.x}" y="${node.y}" width="12" height="${node.height}"></rect><text class="river-node-label" x="${labelX}" y="${labelY}">${escapeHtml(shortText(node.id, 16))}</text></g>`;
    }).join("");

    const chartTitle = graph.detailMode
      ? `其他企业第${graph.pageStartRank}至${graph.pageEndRank}名产业链布局流`
      : "中国企业产业链布局流";
    const chartDescription = graph.detailMode
      ? `当前分页显示其他企业中排名第${graph.pageStartRank}至${graph.pageEndRank}的机构，从时间区间流向企业，再流向产业链二级指标。`
      : "主题专利从时间区间流向中国企业，再流向产业链二级指标。";
    const companyColumnLabel = graph.detailMode
      ? `其他企业 第${graph.pageStartRank}-${graph.pageEndRank}名`
      : "中国企业";
    return `<svg viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="riverChartTitle riverChartDescription">
      <title id="riverChartTitle">${escapeHtml(chartTitle)}</title>
      <desc id="riverChartDescription">${escapeHtml(chartDescription)}时间按新到旧由上至下排列。河流宽度表示主体与专利族的关系数，企业名称可打开企业画像。</desc>
      <text class="river-column-label" x="28" y="25">时间区间</text>
      <text class="river-column-label" x="306" y="25">${escapeHtml(companyColumnLabel)}</text>
      <text class="river-column-label" x="620" y="25">产业链二级指标</text>
      <text class="river-column-label" x="888" y="25" text-anchor="end">专利族关系数</text>
      <g>${links.join("")}</g>
      <g>${nodeMarkup(bands, "time")}${nodeMarkup(companies, "company")}${nodeMarkup(chains, "chain")}</g>
    </svg>`;
  }

  function render() {
    if (!index?.topics) {
      root.innerHTML = '<div class="river-error">主题企业索引未加载，无法生成权利河流图。</div>';
      return;
    }
    const topic = index.topics[String(state.topicId)];
    if (!topic) {
      root.innerHTML = `<div class="river-empty">主题 ${escapeHtml(state.topicId)} 暂无河流图数据。</div>`;
      return;
    }
    const graph = buildGraph(topic);
    const scopeLabel = state.scope === "recent" ? `近20年（${YEAR_NOW - 19}-${YEAR_NOW}，按年度倒序展开）` : "全时间段（最多12个连续时间段，倒序排列）";
    const headDescription = graph?.detailMode
      ? `${scopeLabel}，当前下钻查看其他企业第 ${graph.pageStartRank}-${graph.pageEndRank} 名。`
      : `${scopeLabel}，从专利时间流向中国企业，再归入产业链二级指标。`;
    const drillBar = graph?.detailMode ? `<div class="river-drillbar" aria-live="polite">
      <div class="river-drill-summary"><strong>其他企业下钻</strong><span>第 ${nf.format(graph.pageStartRank)}-${nf.format(graph.pageEndRank)} 名 · 共 ${nf.format(graph.hiddenCompanyCount)} 家长尾机构</span></div>
      <div class="river-drill-actions" aria-label="其他企业分页">
        <button type="button" data-river-page="0" data-river-page-direction="overview">返回 Top ${state.limit}</button>
        <button type="button" data-river-page="${graph.longTailPage - 1}" data-river-page-direction="prev" ${graph.longTailPage <= 1 ? "disabled" : ""}>上一页</button>
        <span class="river-page-status">${nf.format(graph.longTailPage)} / ${nf.format(graph.longTailPageCount)}</span>
        <button type="button" data-river-page="${graph.longTailPage + 1}" data-river-page-direction="next" ${graph.longTailPage >= graph.longTailPageCount ? "disabled" : ""}>下一页</button>
      </div>
    </div>` : "";
    const stageLabel = graph?.detailMode
      ? `其他企业第${graph.pageStartRank}至${graph.pageEndRank}名产业链河流图，窄屏可左右滑动查看完整路径`
      : "中国企业产业链河流图，窄屏可左右滑动查看完整路径";
    const note = graph?.detailMode
      ? `当前分页展示其他企业第 ${nf.format(graph.pageStartRank)}-${nf.format(graph.pageEndRank)} 名，共 ${nf.format(graph.visibleCompanyCount)} 家机构、${nf.format(graph.mappedFamilies)} 个专利族；右侧关系数仅按当前页重新计算，可返回 Top ${state.limit} 总览。`
      : graph?.hiddenCompanyCount
        ? `当前涉及 ${nf.format(graph.sourceCompanyCount)} 个中国非个人主体；前 ${state.limit} 家逐一展示，其余 ${nf.format(graph.hiddenCompanyCount)} 家汇入“其他企业”，共 ${nf.format(graph.hiddenRelationCount)} 条专利族关系（占 ${(graph.hiddenRelationShare * 100).toFixed(1)}%），点击该节点可分页查看。`
        : `当前显示 ${nf.format(graph?.mappedFamilies || 0)} 个已归入 ${nf.format(graph?.chainMetricCount || 0)} 个产业链二级指标的专利族，涉及 ${nf.format(graph?.sourceCompanyCount || 0)} 个中国非个人主体。`;
    root.innerHTML = `<div class="river-head">
      <div><h2>中国企业产业链布局流</h2><p>${headDescription}</p></div>
      <div class="river-controls">
        <div class="river-control-group" role="group" aria-label="时间范围"><button class="${state.scope === "recent" ? "active" : ""}" type="button" data-river-scope="recent" aria-pressed="${state.scope === "recent"}">近20年</button><button class="${state.scope === "full" ? "active" : ""}" type="button" data-river-scope="full" aria-pressed="${state.scope === "full"}">全期</button></div>
        <div class="river-control-group" role="group" aria-label="企业数量"><button class="${state.limit === 10 ? "active" : ""}" type="button" data-river-limit="10" aria-pressed="${state.limit === 10}">Top 10</button><button class="${state.limit === 30 ? "active" : ""}" type="button" data-river-limit="30" aria-pressed="${state.limit === 30}">Top 30</button></div>
      </div>
    </div>
    ${graph ? `${drillBar}<div class="river-stage" tabindex="0" aria-label="${escapeAttr(stageLabel)}">${renderSvg(graph)}</div><p class="river-note">${note}</p>` : `<div class="river-empty">${scopeLabel}内暂无可映射到产业链二级指标的中国非个人主体专利族。可切换到“全期”查看。</div>`}
    <div class="river-tooltip" id="riverTooltip" aria-hidden="true"></div>`;
  }

  function highlight(selection, active) {
    const selected = selection || {};
    const companyIds = Array.isArray(selected.companyIds) ? selected.companyIds : [selected.companyId].filter(Boolean);
    const selectedCompanies = new Set(companyIds);
    const hasId = (value, id) => String(value || "").split(" ").filter(Boolean).includes(id);
    root.querySelectorAll(".river-link").forEach(path => {
      const pathIds = String(path.dataset.companyIds || "").split(" ").filter(Boolean);
      const matches = selected.bandId
        ? path.dataset.bandId === selected.bandId || hasId(path.dataset.bandIds, selected.bandId)
        : selected.chainId
          ? path.dataset.chainId === selected.chainId || hasId(path.dataset.chainIds, selected.chainId)
          : pathIds.some(id => selectedCompanies.has(id));
      path.classList.toggle("dimmed", active && !matches);
      path.classList.toggle("active", active && matches);
    });
  }

  function showTooltip(event, value) {
    const tooltip = root.querySelector("#riverTooltip");
    if (!tooltip || !value) return;
    const [title, ...lines] = value.split("|");
    tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong>${lines.map(line => `<span>${escapeHtml(line)}</span>`).join("<br>")}`;
    tooltip.classList.add("show");
    tooltip.setAttribute("aria-hidden", "false");
    moveTooltip(event);
  }
  function moveTooltip(event) {
    const tooltip = root.querySelector("#riverTooltip");
    if (!tooltip?.classList.contains("show")) return;
    const gap = 12;
    const width = tooltip.offsetWidth || 300;
    const height = tooltip.offsetHeight || 90;
    tooltip.style.left = `${Math.max(gap, Math.min(event.clientX + gap, window.innerWidth - width - gap))}px`;
    tooltip.style.top = `${Math.max(gap, Math.min(event.clientY + gap, window.innerHeight - height - gap))}px`;
  }
  function hideTooltip() {
    const tooltip = root.querySelector("#riverTooltip");
    tooltip?.classList.remove("show");
    tooltip?.setAttribute("aria-hidden", "true");
  }

  root.addEventListener("click", event => {
    const pageControl = event.target.closest("[data-river-page]");
    if (pageControl && !pageControl.disabled) {
      const direction = pageControl.dataset.riverPageDirection;
      state.longTailPage = Number(pageControl.dataset.riverPage);
      render();
      if (direction === "overview") {
        root.querySelector('[data-river-action="drilldown"]')?.focus();
      } else {
        (root.querySelector(`[data-river-page-direction="${direction}"]:not(:disabled)`)
          || root.querySelector('[data-river-page-direction="prev"]:not(:disabled)'))?.focus();
      }
      return;
    }
    const scope = event.target.closest("[data-river-scope]");
    if (scope) {
      state.scope = scope.dataset.riverScope;
      state.longTailPage = 0;
      render();
      root.querySelector(`[data-river-scope="${state.scope}"]`)?.focus();
      return;
    }
    const limit = event.target.closest("[data-river-limit]");
    if (limit) {
      state.limit = Number(limit.dataset.riverLimit);
      state.longTailPage = 0;
      render();
      root.querySelector(`[data-river-limit="${state.limit}"]`)?.focus();
      return;
    }
    const drilldown = event.target.closest('[data-river-action="drilldown"]');
    if (drilldown) {
      state.longTailPage = 1;
      render();
      root.querySelector('[data-river-page-direction="overview"]')?.focus();
      return;
    }
    const company = event.target.closest(".river-company-node");
    if (company && company.dataset.riverDisabled !== "true") openEnterpriseProfile(company.dataset.companyName);
  });
  root.addEventListener("keydown", event => {
    const company = event.target.closest(".river-company-node");
    if (!company || company.dataset.riverDisabled === "true" || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (company.dataset.riverAction === "drilldown") {
      state.longTailPage = 1;
      render();
      root.querySelector('[data-river-page-direction="overview"]')?.focus();
      return;
    }
    openEnterpriseProfile(company.dataset.companyName);
  });
  root.addEventListener("pointerover", event => {
    const path = event.target.closest(".river-link");
    const company = event.target.closest(".river-company-node");
    const filterNode = event.target.closest(".river-filter-node");
    const target = path || company || filterNode;
    if (!target) return;
    const selection = filterNode?.dataset.bandId
      ? { bandId: filterNode.dataset.bandId }
      : filterNode?.dataset.chainId
        ? { chainId: filterNode.dataset.chainId }
        : { companyIds: path ? String(path.dataset.companyIds || "").split(" ").filter(Boolean) : [target.dataset.companyId].filter(Boolean) };
    highlight(selection, true);
    if (path?.dataset.riverTip) showTooltip(event, path.dataset.riverTip);
    else if (company?.dataset.riverTip) showTooltip(event, company.dataset.riverTip);
  });
  root.addEventListener("pointermove", moveTooltip);
  root.addEventListener("pointerout", event => {
    if (event.relatedTarget && root.contains(event.relatedTarget) && event.relatedTarget.closest?.(".river-link,.river-company-node,.river-filter-node")) return;
    highlight({}, false);
    hideTooltip();
  });
  root.addEventListener("focusin", event => {
    const company = event.target.closest(".river-company-node");
    const filterNode = event.target.closest(".river-filter-node");
    if (company) highlight({ companyId: company.dataset.companyId }, true);
    else if (filterNode?.dataset.bandId) highlight({ bandId: filterNode.dataset.bandId }, true);
    else if (filterNode?.dataset.chainId) highlight({ chainId: filterNode.dataset.chainId }, true);
  });
  root.addEventListener("focusout", event => {
    if (!event.relatedTarget?.closest?.(".river-company-node,.river-filter-node")) highlight({}, false);
  });
  document.addEventListener("frontier:topic-change", event => {
    state.topicId = Number(event.detail?.topicId);
    state.longTailPage = 0;
    render();
  });

  render();
  if (location.hash === "#enterpriseRiverPanel") {
    requestAnimationFrame(() => root.scrollIntoView({ block: "start" }));
    window.setTimeout(() => root.scrollIntoView({ block: "start" }), 400);
  }
})();
