// Fetch website payloads from the FastAPI server and publish them as the
// same window globals the page scripts already expect.
const specs = {
  "atlas-dashboard": "DASHBOARD_DATA",
  "derwent-dashboard": "FUSION_DASHBOARD_DATA",
  "enterprise-insights": "ENTERPRISE_INSIGHTS",
  "enterprise-directory": "ENTERPRISE_DIRECTORY_MASTER",
  "shareholder-leads": "SHAREHOLDER_LEADS",
  "frontier-index": "FRONTIER_ENTERPRISE_INDEX",
  "frontier-dashboard": "FRONTIER_DASHBOARD_DATA",
  "verified-events": "FUSION_VERIFIED_EVENTS",
  "world-map": null, // multi-global GeoJSON snapshot, spread onto window
};

let statusEl = null;

function showStatus(text) {
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "fusion-load-status";
    statusEl.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:8px 14px;" +
      "background:#18324d;color:#fff;font:13px/1.5 system-ui,sans-serif;border-radius:6px;";
    document.body.appendChild(statusEl);
  }
  statusEl.textContent = text;
}

async function fetchPayload(name) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(`/api/payload/${name}`);
    } catch (error) {
      showStatus(`无法连接数据服务，正在重试…（${name}）`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }
    if (response.status === 503) {
      showStatus("服务端正在从统一数据库构建数据，请稍候…");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    return response.json();
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(el);
  });
}

export async function loadPayloads(names, scripts = []) {
  showStatus("数据加载中…");
  const values = await Promise.all(names.map(fetchPayload));
  names.forEach((name, index) => {
    const globalName = specs[name];
    if (globalName) window[globalName] = values[index];
    else Object.assign(window, values[index]);
  });
  for (const src of scripts) await loadScript(src);
  statusEl && statusEl.remove();
  statusEl = null;
}
