(() => {
  const script = document.currentScript;
  const requestedModule = document.documentElement.dataset.module || new URLSearchParams(location.search).get("module") || "";
  const active = ["industry", "china"].includes(requestedModule) ? requestedModule : script?.dataset.active || "";
  const items = [
    ["home", "⌂", "系统首页", "index.html#home"],
    ["technology", "01", "技术演进脉络", "index.html#technology"],
    ["industry", "02", "地理版图洞察", "index.html#industry"],
    ["enterprise", "03", "企业画像", "index.html#enterprise"],
    ["frontier", "04", "前沿技术关注", "index.html#frontier"]
  ];
  const moduleScaffold = {
    technology: {
      brand: "FUSION / TECHNOLOGY",
      eyebrow: "TECHNOLOGY EVOLUTION · PATENT INTELLIGENCE",
      title: "技术演进脉络",
      description: "从知识流动、引文网络、关键路径与国家趋势观察核聚变技术演进。",
      index: "01 / 04",
      sectionCode: "01 · TECHNOLOGY LANDSCAPE",
      sectionTitle: "全球技术演进与知识流动"
    },
    enterprise: {
      brand: "FUSION / ENTERPRISE",
      eyebrow: "ENTERPRISE INTELLIGENCE · PATENT PORTRAIT",
      title: "企业画像",
      description: "从产业链定位、技术路线、战略分群与代表专利观察核聚变企业竞争力。",
      index: "03 / 04",
      sectionCode: "01 · ENTERPRISE INTELLIGENCE",
      sectionTitle: "企业产业链定位与技术画像"
    },
    frontier: {
      brand: "FUSION / FRONTIER",
      eyebrow: "FRONTIER TECHNOLOGY · TOPIC INTELLIGENCE",
      title: "前沿技术关注",
      description: "从IPC主题、增长趋势、影响力与跨领域信号识别前沿技术机会。",
      index: "04 / 04",
      sectionCode: "01 · IPC TOPIC ANALYSIS",
      sectionTitle: "IPC主题与前沿技术分析"
    }
  };
  const nav = document.createElement("nav");
  nav.className = "fusion-site-nav";
  nav.setAttribute("aria-label", "网站模块导航");
  nav.innerHTML = `
    <button class="fusion-nav-toggle" type="button" aria-expanded="false" aria-label="展开网站导航">
      <span class="fusion-nav-icon" aria-hidden="true"></span><span class="fusion-nav-label">网站导航</span>
    </button>
    <div class="fusion-nav-divider" aria-hidden="true"></div>
    ${items.map(([id, icon, label, href]) => `
      <a class="fusion-nav-link" href="${href}"${active === id ? ' aria-current="page"' : ""}>
        <span class="fusion-nav-icon" aria-hidden="true">${icon}</span><span class="fusion-nav-label">${label}</span>
      </a>`).join("")}`;
  const mount = () => {
    if (!document.body || document.querySelector(".fusion-site-nav")) return;
    const scaffold = moduleScaffold[active];
    if (scaffold && !document.querySelector(".fusion-module-hero")) {
      document.documentElement.dataset.unifiedLayout = "true";
      const hero = document.createElement("header");
      hero.className = "fusion-module-hero";
      hero.innerHTML = `
        <div class="fusion-module-brand"><i></i><span>${scaffold.brand}</span></div>
        <div class="fusion-module-copy">
          <p>${scaffold.eyebrow}</p>
          <h1>${scaffold.title}</h1>
          <span>${scaffold.description}</span>
        </div>
        <div class="fusion-module-index">${scaffold.index}</div>`;
      const sectionHead = document.createElement("div");
      sectionHead.className = "fusion-module-section-head";
      sectionHead.innerHTML = `<div><span>${scaffold.sectionCode}</span><h2>${scaffold.sectionTitle}</h2></div>`;
      if (active === "technology") {
        const shell = document.querySelector(".shell");
        const main = shell?.querySelector("main");
        if (shell) document.body.insertBefore(hero, shell);
        if (main) main.prepend(sectionHead);
      } else if (active === "enterprise") {
        const main = document.querySelector("main");
        const view = document.getElementById("enterpriseView");
        if (main) document.body.insertBefore(hero, main);
        if (main && view) main.insertBefore(sectionHead, view);
      } else if (active === "frontier") {
        const shell = document.querySelector(".shell");
        if (shell) {
          document.body.insertBefore(hero, shell);
          document.body.insertBefore(sectionHead, shell);
        }
      }
    }
    document.body.prepend(nav);
    const toggle = nav.querySelector(".fusion-nav-toggle");
    nav.addEventListener("click", event => {
      const link = event.target.closest(".fusion-nav-link");
      if (!link || window.parent === window) return;
      const item = items.find(([, , , href]) => href === link.getAttribute("href"));
      if (!item) return;
      event.preventDefault();
      window.parent.postMessage({ type: "fusion:navigate", view: item[0] }, "*");
    });
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("pointerdown", event => {
      if (!nav.contains(event.target) && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    }, { passive: true });
    window.addEventListener("message", event => {
      if (event.data?.type !== "fusion:visibility") return;
      document.documentElement.toggleAttribute("data-view-visible", Boolean(event.data.visible));
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
