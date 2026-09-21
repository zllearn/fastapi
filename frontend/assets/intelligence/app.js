(() => {
  "use strict";

  const payload = window.FUSION_VERIFIED_EVENTS;
  const root = document.getElementById("enterpriseView");
  const intelligenceView = document.getElementById("enterpriseIntelligence");
  if (!payload?.events?.length || !root || !intelligenceView) return;

  const events = payload.events.filter(event => ["中国", "中国大陆"].includes(String(event.company_country || "").trim())).sort((a, b) =>
    String(b.published_at).localeCompare(String(a.published_at)) || Number(b.event_id) - Number(a.event_id)
  );
  const pageSize = 10;
  const state = { page: 1, openId: null, company: "", minEvents: 0, route: "", chain: "" };
  const colors = { "招投标": "#315c79", "合同": "#247f70", "协议": "#e9632d", "投融资": "#8c174f" };
  const companyEventCounts = events.reduce((counts, event) => {
    counts.set(event.company_name, (counts.get(event.company_name) || 0) + 1);
    return counts;
  }, new Map());
  let modeReady = false;

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const displayEnterpriseName = window.FUSION_ENTERPRISE_NAME?.display || (value => String(value || ""));
  const dateOnly = value => String(value || "").slice(0, 10);
  const externalUrl = event => /^https?:\/\//i.test(String(event.source_url || "")) ? event.source_url : "";
  const routeValues = event => String(event.company_main_direction || "")
    .split("/").map(value => value.trim())
    .filter(value => value && !value.includes("待联网画像校准"));
  const chainValues = event => {
    const raw = event.industry_chain_level || event.chain_level || event.industry_chain || "";
    const values = Array.isArray(raw) ? raw : String(raw).split(/[\/、,，;；]/);
    return values.map(value => String(value).trim()).map(value => {
      if (value.includes("上游")) return "上游";
      if (value.includes("中游")) return "中游";
      if (value.includes("下游")) return "下游";
      return value;
    }).filter(Boolean);
  };

  function filteredEvents() {
    return events.filter(event => {
      if (state.company && !String(event.company_name || "").toLocaleLowerCase("zh-CN").includes(state.company)) return false;
      if ((companyEventCounts.get(event.company_name) || 0) < state.minEvents) return false;
      if (state.route && !routeValues(event).includes(state.route)) return false;
      if (state.chain && !chainValues(event).includes(state.chain)) return false;
      return true;
    });
  }

  function initControls() {
    $("intelligencePrev").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderFeed(); } });
    $("intelligenceNext").addEventListener("click", () => {
      const max = Math.max(1, Math.ceil(filteredEvents().length / pageSize));
      if (state.page < max) { state.page += 1; renderFeed(); }
    });
  }

  function initFilters() {
    const routeSelect = $("intelligenceRoute");
    const routes = [...new Set(events.flatMap(routeValues))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    routeSelect.insertAdjacentHTML("beforeend", routes.map(route => `<option value="${escapeHtml(route)}">${escapeHtml(route)}</option>`).join(""));

    const chainSelect = $("intelligenceChain");
    const chains = [...new Set(events.flatMap(chainValues))];
    const chainOrder = ["上游", "中游", "下游"];
    chains.sort((a, b) => {
      const ai = chainOrder.indexOf(a), bi = chainOrder.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
      return a.localeCompare(b, "zh-CN");
    });
    if (chains.length) {
      chainSelect.insertAdjacentHTML("beforeend", chains.map(chain => `<option value="${escapeHtml(chain)}">${escapeHtml(chain)}</option>`).join(""));
    } else {
      chainSelect.innerHTML = '<option value="">暂无产业链标签</option>';
      chainSelect.disabled = true;
    }

    const update = () => { state.page = 1; renderFeed(); };
    $("intelligenceCompanySearch").addEventListener("input", event => { state.company = event.target.value.trim().toLocaleLowerCase("zh-CN"); update(); });
    $("intelligenceEventCount").addEventListener("change", event => { state.minEvents = Number(event.target.value) || 0; update(); });
    routeSelect.addEventListener("change", event => { state.route = event.target.value; update(); });
    chainSelect.addEventListener("change", event => { state.chain = event.target.value; update(); });
    $("intelligenceReset").addEventListener("click", () => {
      state.company = ""; state.minEvents = 0; state.route = ""; state.chain = ""; state.page = 1;
      $("intelligenceCompanySearch").value = "";
      $("intelligenceEventCount").value = "0";
      routeSelect.value = "";
      chainSelect.value = "";
      renderFeed();
    });
  }

  function initModeSwitch() {
    root.querySelectorAll("[data-enterprise-mode]").forEach(button => button.addEventListener("click", () => {
      const mode = button.dataset.enterpriseMode;
      root.querySelectorAll("[data-enterprise-mode]").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      root.querySelectorAll("[data-enterprise-panel]").forEach(panel => { panel.hidden = panel.dataset.enterprisePanel !== mode; });
      if (mode === "intelligence") {
        if (!modeReady) { modeReady = true; render(); }
      } else {
        window.dispatchEvent(new Event("resize"));
      }
    }));
    const requestedMode = new URLSearchParams(location.search).get("enterpriseMode");
    const requestedButton = requestedMode ? root.querySelector(`[data-enterprise-mode="${requestedMode}"]`) : null;
    if (requestedButton) setTimeout(() => requestedButton.click(), 0);
  }

  function eventButton(event) {
    const color = colors[event.event_type] || "#315c79";
    const detailId = `intelligenceDetail-${event.event_id}`;
    const url = externalUrl(event);
    return `<article class="intelligence-event-item" data-event-item="${event.event_id}" style="--event-color:${color}">
      <button class="intelligence-event" type="button" data-event-id="${event.event_id}" aria-expanded="false" aria-controls="${detailId}">
        <div class="intelligence-event-date">${dateOnly(event.published_at)}<b>${escapeHtml(event.event_type)}</b></div>
        <div><h4 class="intelligence-event-title">${escapeHtml(event.title)}</h4><p class="intelligence-event-summary">${escapeHtml(event.summary)}</p><div class="intelligence-event-meta"><span>${escapeHtml(displayEnterpriseName(event.company_name))}</span><span>${escapeHtml(event.company_province)} · ${escapeHtml(event.company_city || "未标注")}</span><span>${escapeHtml(event.company_tier)}</span><span>该企业 ${companyEventCounts.get(event.company_name) || 1} 条事件</span></div></div>
        <div class="intelligence-event-side"><strong>${escapeHtml(event.amount_text || "金额未披露")}</strong><span>${escapeHtml(event.source_name || "来源未标注")}</span></div>
      </button>
      <div id="${detailId}" class="intelligence-inline-detail" aria-hidden="true" inert>
        <div class="intelligence-inline-detail-clip">
          <section class="intelligence-detail" aria-live="polite">
            <div class="intelligence-detail-head"><div><p class="kicker">VERIFIED EVENT · ${escapeHtml(event.review_status)}</p><h3>${escapeHtml(event.title)}</h3></div><button type="button" data-close-detail aria-label="关闭详情">×</button></div>
            <div class="intelligence-detail-meta"><span>${dateOnly(event.published_at)}</span><span>${escapeHtml(event.event_type)}</span><span>${escapeHtml(displayEnterpriseName(event.company_name))}</span><span>${escapeHtml(event.company_tier)}</span><span>${escapeHtml(event.company_province)} · ${escapeHtml(event.company_city || "未标注")}</span><span>${escapeHtml(event.origin_label)}</span></div>
            <div class="intelligence-detail-body"><section><h4>事件摘要</h4><p>${escapeHtml(event.summary)}</p><h4>企业与交易信息</h4><p>技术方向：${escapeHtml(event.company_main_direction)}<br>企业角色：${escapeHtml(event.company_role || "未标注")}<br>交易或合作方：${escapeHtml(event.counterparty || "未披露")}<br>金额：${escapeHtml(event.amount_text || "未披露")}</p></section><aside><h4>核验证据</h4><p class="intelligence-evidence">${escapeHtml(event.evidence)}</p><h4>信息来源</h4><p>${escapeHtml(event.source_name || "未标注")}<br>${escapeHtml(event.source_domain || (event.source_kind === "choice_terminal_history" ? "Choice 金融终端内部来源" : "无公开域名"))}</p>${url ? `<a class="intelligence-source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">查看公开来源 ↗</a>` : '<span class="intelligence-source-link is-disabled">内部来源 · 无公开链接</span>'}</aside></div>
          </section>
        </div>
      </div>
    </article>`;
  }

  function renderFeed() {
    const filtered = filteredEvents();
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, pages);
    state.openId = null;
    const pageItems = filtered.slice((state.page - 1) * pageSize, state.page * pageSize);
    const companyCount = new Set(filtered.map(event => event.company_name)).size;
    $("intelligenceResultCount").textContent = `${filtered.length.toLocaleString("zh-CN")} 条结果 · ${companyCount.toLocaleString("zh-CN")} 家企业`;
    $("intelligenceFeed").innerHTML = pageItems.length ? pageItems.map(eventButton).join("") : '<div class="intelligence-empty">没有符合当前条件的核验资讯，请调整筛选条件。</div>';
    $("intelligencePage").textContent = `${state.page} / ${pages}`;
    $("intelligencePrev").disabled = state.page <= 1;
    $("intelligenceNext").disabled = state.page >= pages;
    $("intelligenceFeed").querySelectorAll("[data-event-id]").forEach(button => button.addEventListener("click", () => toggleDetail(Number(button.dataset.eventId))));
    $("intelligenceFeed").querySelectorAll("[data-close-detail]").forEach(button => button.addEventListener("click", () => closeDetail(button.closest("[data-event-item]"))));
  }

  function setDetailState(item, open) {
    if (!item) return;
    item.classList.toggle("is-open", open);
    item.querySelector("[data-event-id]")?.setAttribute("aria-expanded", String(open));
    const detail = item.querySelector(".intelligence-inline-detail");
    detail?.setAttribute("aria-hidden", String(!open));
    detail?.toggleAttribute("inert", !open);
  }

  function closeDetail(item) {
    setDetailState(item, false);
    if (item && Number(item.dataset.eventItem) === state.openId) state.openId = null;
  }

  function toggleDetail(eventId) {
    const nextItem = $("intelligenceFeed").querySelector(`[data-event-item="${eventId}"]`);
    if (!nextItem) return;
    if (state.openId === eventId) {
      closeDetail(nextItem);
      return;
    }
    if (state.openId !== null) {
      const currentItem = $("intelligenceFeed").querySelector(`[data-event-item="${state.openId}"]`);
      setDetailState(currentItem, false);
    }
    state.openId = eventId;
    setDetailState(nextItem, true);
  }

  function render() {
    renderFeed();
  }

  initModeSwitch();
  initControls();
  initFilters();
})();
