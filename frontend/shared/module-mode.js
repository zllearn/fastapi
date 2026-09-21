(() => {
  "use strict";

  const root = document.documentElement;
  const query = new URLSearchParams(location.search);
  const moduleName = root.dataset.module || query.get("module") || "legacy";
  root.dataset.module = moduleName;

  const activate = view => {
    const button = document.querySelector(`[data-view="${view}"]`);
    if (button && !button.classList.contains("active")) button.click();
  };

  if (moduleName === "enterprise") {
    document.title = "企业画像 · 未来产业洞见系统";
    activate("enterprise");
  } else if (moduleName === "china") {
    document.title = "中国地区产业图谱 · 地理版图洞察";
    activate("china");
  } else if (moduleName === "technology") {
    document.title = "技术演进脉络 · 未来产业洞见系统";
    activate("world");
  } else if (moduleName === "industry") {
    document.title = "产业三维动态对比分析 · 地理版图洞察";
    const filterDock = document.querySelector(".filter-dock");
    if (filterDock) filterDock.hidden = false;
    activate("world");
  } else if (moduleName === "frontier") {
    document.title = "前沿技术关注 · 未来产业洞见系统";
  }

  if (query.get("embed") !== "1") return;
  const reportHeight = () => {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
    window.parent.postMessage({ type: "fusion:embed-height", module: moduleName, height }, "*");
  };
  window.addEventListener("load", reportHeight, { once: true });
  window.addEventListener("resize", reportHeight, { passive: true });
  if (window.ResizeObserver && document.body) new ResizeObserver(reportHeight).observe(document.body);
  setTimeout(reportHeight, 250);
})();
