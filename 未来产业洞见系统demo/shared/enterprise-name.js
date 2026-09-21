(() => {
  "use strict";

  const display = value => String(value ?? "")
    .replace(/\s*[（(]\s*\d+\s*[）)]\s*$/, "")
    .trim();

  window.FUSION_ENTERPRISE_NAME = Object.freeze({ display });
})();
