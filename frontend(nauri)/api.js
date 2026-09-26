(function (global) {
  "use strict";

  const TOKEN_KEY = "nouri.accessToken";
  const REFRESH_KEY = "nouri.refreshToken";
  const USER_KEY = "nouri.user";

  const API_BASE = stripTrailing(window.NOURI_API_BASE || "") ||
    (location.protocol === "file:" ? "http://localhost:5000/api" : "/api");

  function stripTrailing(value) {
    return String(value).replace(/\/+$/, "");
  }

  function getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function setSession(payload) {
    if (payload && payload.accessToken) localStorage.setItem(TOKEN_KEY, payload.accessToken);
    if (payload && payload.refreshToken) localStorage.setItem(REFRESH_KEY, payload.refreshToken);
    if (payload && payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isAuthed() {
    return Boolean(getAccessToken());
  }

  function isAuthPage() {
    const page = location.pathname.split("/").pop() || "";
    return ["login.html", "register.html", "forgot-password.html", "reset-password.html", "index.html"].includes(page);
  }

  async function refreshSession() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token available.");
    const data = await rawRequest("/auth/refresh", {
      method: "POST",
      json: { refreshToken },
      allowRefresh: false,
    });
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data;
  }

  function makeUrl(path) {
    if (/^https?:\/\//.test(path)) return path;
    return API_BASE + (path.startsWith("/") ? path : `/${path}`);
  }

  async function rawRequest(path, options = {}) {
    const {
      method = "GET",
      json,
      form,
      headers = {},
      allowRefresh = true,
    } = options;

    const fetchOptions = { method, headers: { ...headers } };
    if (json !== undefined) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(json);
    } else if (form !== undefined) {
      fetchOptions.body = form;
    }

    const token = getAccessToken();
    if (token) fetchOptions.headers["Authorization"] = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(makeUrl(path), fetchOptions);
    } catch (err) {
      throw new Error(`Could not reach the Nouri server. Is it running at ${API_BASE}?`);
    }

    if (response.status === 401 && allowRefresh) {
      try {
        await refreshSession();
        return await rawRequest(path, { ...options, allowRefresh: false });
      } catch (refreshError) {
        clearSession();
        if (!isAuthPage()) location.href = "login.html";
        throw new Error("Your session has expired. Please log in again.");
      }
    }

    let body = null;
    try {
      body = await response.json();
    } catch (err) {
      body = null;
    }

    if (!response.ok) {
      const message = body && body.error && body.error.message
        ? body.error.message
        : `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.code = body && body.error && body.error.code;
      error.details = body && body.error && body.error.details;
      throw error;
    }

    return body && body.success !== undefined ? body.data : body;
  }

  async function request(path, options = {}) {
    return rawRequest(path, options);
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await rawRequest("/auth/logout", { method: "POST", json: { refreshToken }, allowRefresh: false });
    } catch (err) {
      // ignore network errors on logout
    }
    clearSession();
  }

  function requireAuth() {
    if (!isAuthed()) {
      location.href = "login.html";
      return false;
    }
    return true;
  }

  function guardGuest() {
    if (isAuthed()) {
      location.href = "dashboard.html";
      return false;
    }
    return true;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    const parts = String(name || "U").trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name || "U").slice(0, 2).toUpperCase();
  }

  function toast(message, kind) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle("toast-error", kind === "error");
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  /* ---- date helpers (mirror backend utils) ---- */

  function dateString(input) {
    const d = input instanceof Date ? input : new Date(input);
    return d.toISOString().slice(0, 10);
  }

  function today() {
    return dateString(new Date());
  }

  function addDays(dateStr, days) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + Number(days));
    return d.toISOString().slice(0, 10);
  }

  function startOfWeek(dateStr) {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDays(dateStr, diff);
  }

  function weekdayShort(dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
  }

  function monthShort(dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
  }

  function dayOfMonth(dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`).getUTCDate();
  }

  function formatRange(startDate, endDate) {
    return `${monthShort(startDate)} ${dayOfMonth(startDate)}–${dayOfMonth(endDate)}`;
  }

  const Nouri = {
    API_BASE,
    request,
    logout,
    setSession,
    clearSession,
    getAccessToken,
    getRefreshToken,
    getUser,
    isAuthed,
    requireAuth,
    guardGuest,
    escapeHTML,
    initials,
    toast,
    date: { today, addDays, startOfWeek, weekdayShort, monthShort, dayOfMonth, formatRange },
  };

  global.Nouri = Nouri;
})(window);