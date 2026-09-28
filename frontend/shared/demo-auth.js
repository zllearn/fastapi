(() => {
  "use strict";

  const SESSION_KEY = "futureIndustryInsightAuth";
  const login = document.getElementById("demoLogin");
  const form = document.getElementById("demoLoginForm");
  const username = document.getElementById("demoUsername");
  const password = document.getElementById("demoPassword");
  const error = document.getElementById("demoLoginError");
  const passwordToggle = document.getElementById("demoPasswordToggle");
  const submit = form?.querySelector(".demo-login-submit");

  if (!login || !form || !username || !password || !error) return;

  const isAuthenticated = () => {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; }
    catch (_) { return false; }
  };

  const setAuthenticated = authenticated => {
    document.body.classList.toggle("demo-authenticated", authenticated);
    login.hidden = authenticated;
    login.setAttribute("aria-hidden", String(authenticated));
    document.getElementById("views")?.setAttribute("aria-hidden", String(!authenticated));
    try {
      if (authenticated) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (_) {}
    if (!authenticated) requestAnimationFrame(() => username.focus());
  };

  // 先问服务端：会话 Cookie 仍有效（或服务端未启用鉴权）则直接进入。
  fetch("/api/auth/session").then(r => r.json()).then(data => {
    setAuthenticated(!!data.authenticated);
  }).catch(() => {
    setAuthenticated(isAuthenticated());
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.textContent = "";
    if (submit) {
      submit.setAttribute("aria-busy", "true");
      submit.disabled = true;
    }
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.value.trim(), password: password.value }),
      });
      if (response.ok) {
        password.value = "";
        setAuthenticated(true);
        return;
      }
      const detail = await response.json().catch(() => ({}));
      error.textContent = detail.detail
        || (response.status === 429 ? "尝试过于频繁，请稍后再试。" : "登录失败，请稍后重试。");
    } catch (_) {
      error.textContent = "无法连接服务，请确认服务已启动后重试。";
    } finally {
      submit?.removeAttribute("aria-busy");
      submit.disabled = false;
      password.value = "";
      password.focus();
    }
  });

  passwordToggle?.addEventListener("click", () => {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    passwordToggle.textContent = visible ? "显示" : "隐藏";
    passwordToggle.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
    password.focus();
  });
})();
