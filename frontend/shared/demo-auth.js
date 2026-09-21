(() => {
  "use strict";

  const SESSION_KEY = "futureIndustryInsightDemoAuth";
  const DEMO_USERNAME = "admin";
  const DEMO_PASSWORD = "fusion2026";
  const login = document.getElementById("demoLogin");
  const form = document.getElementById("demoLoginForm");
  const username = document.getElementById("demoUsername");
  const password = document.getElementById("demoPassword");
  const error = document.getElementById("demoLoginError");
  const passwordToggle = document.getElementById("demoPasswordToggle");

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
    if (!authenticated) requestAnimationFrame(() => username.focus());
  };

  setAuthenticated(isAuthenticated());

  form.addEventListener("submit", event => {
    event.preventDefault();
    const valid = username.value.trim() === DEMO_USERNAME && password.value === DEMO_PASSWORD;
    if (!valid) {
      error.textContent = "用户名或密码不正确，请重新输入。";
      password.value = "";
      password.focus();
      return;
    }
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (_) {}
    error.textContent = "";
    setAuthenticated(true);
  });

  passwordToggle?.addEventListener("click", () => {
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    passwordToggle.textContent = visible ? "显示" : "隐藏";
    passwordToggle.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
    password.focus();
  });
})();
