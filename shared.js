/** Shared config + API helpers for Phone Site pages. */
const PhoneSite = (() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbypa1N6yeEjTURZE-5_krWUUdEHqDfi_pjXKRNa9YvigIAMa6ny6NSfychr8QA4gpdn/exec";
  const USER_ID = "phone-site-primary";
  const AUTH_TOKEN = "vNJedS4GV9YHLiYGszKbliHCweFRlqHu3Uqx7huV7oA";
  const OUTBOX_KEY = "phone-site-outbox";
  const THEME_KEY = "phone-site-dark-mode";

  function newId() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function hashId(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return "seed-" + Math.abs(h).toString(36);
  }

  async function fetchBackendRows() {
    const response = await fetch(
      `${API_URL}?userId=${encodeURIComponent(USER_ID)}&token=${encodeURIComponent(AUTH_TOKEN)}`
    );
    if (!response.ok) throw new Error(`Backend fetch failed: ${response.status}`);
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.data)) return [];
    return result.data;
  }

  function loadOutbox() {
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveOutbox(items) {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-50)));
  }

  function enqueueOutbox(type, data) {
    const box = loadOutbox();
    box.push({ type, data, queuedAt: new Date().toISOString() });
    saveOutbox(box);
  }

  async function postBackend(type, data, options = {}) {
    const { queueOnFail = true } = options;
    try {
      const params = new URLSearchParams({
        userId: USER_ID,
        type,
        data: JSON.stringify(data),
        token: AUTH_TOKEN
      });
      const response = await fetch(`${API_URL}?${params.toString()}`, { method: "POST" });
      let result = null;
      try {
        result = await response.json();
      } catch {
        /* Apps Script may return empty body */
      }
      if (!response.ok || (result && result.ok === false)) {
        if (queueOnFail) enqueueOutbox(type, data);
        return { ok: false, result };
      }
      return { ok: true, result };
    } catch (error) {
      console.warn(`Remote ${type} save unavailable:`, error);
      if (queueOnFail) enqueueOutbox(type, data);
      return { ok: false, error };
    }
  }

  async function flushOutbox() {
    const box = loadOutbox();
    if (box.length === 0) return { flushed: 0, remaining: 0 };
    const remaining = [];
    let flushed = 0;
    for (const item of box) {
      const result = await postBackend(item.type, item.data, { queueOnFail: false });
      if (result.ok) flushed += 1;
      else remaining.push(item);
    }
    saveOutbox(remaining);
    return { flushed, remaining: remaining.length };
  }

  function getDarkMode() {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v !== null) return v === "true";
      const parsed = JSON.parse(localStorage.getItem("tap-to-reveal-state") || "{}");
      return Boolean(parsed.darkMode);
    } catch {
      return false;
    }
  }

  function setDarkMode(on) {
    localStorage.setItem(THEME_KEY, String(Boolean(on)));
    document.body.classList.toggle("dark", Boolean(on));
  }

  function applyThemeFromStorage() {
    document.body.classList.toggle("dark", getDarkMode());
  }

  return {
    API_URL,
    USER_ID,
    AUTH_TOKEN,
    newId,
    hashId,
    fetchBackendRows,
    postBackend,
    flushOutbox,
    getDarkMode,
    setDarkMode,
    applyThemeFromStorage
  };
})();
