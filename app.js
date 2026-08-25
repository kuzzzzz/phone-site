const API_URL = "https://script.google.com/macros/s/AKfycbypa1N6yeEjTURZE-5_krWUUdEHqDfi_pjXKRNa9YvigIAMa6ny6NSfychr8QA4gpdn/exec";
const USER_ID = "phone-site-primary";
const AUTH_TOKEN = "vNJedS4GV9YHLiYGszKbliHCweFRlqHu3Uqx7huV7oA";
const LOCAL_SEED_URL = "./daily_boost_week1.json";
const STORAGE_KEY = "tap-to-reveal-state";
const SEED_FLAG_KEY = "boost-seed-migrated";

const initialState = {
  currentItem: null,
  savedMessages: [],
  viewedIds: [],
  noRepeat: true,
  darkMode: false
};

let boostPool = [];
let feedbackMap = {};
let state = loadState();

const output = document.getElementById("output");
const boostText = document.getElementById("boostText");
const boostAuthor = document.getElementById("boostAuthor");
const boostLink = document.getElementById("boostLink");
const boostLinkLabel = document.getElementById("boostLinkLabel");
const repeatStats = document.getElementById("repeatStats");
const status = document.getElementById("status");
const revealBtn = document.getElementById("revealBtn");
const copyBtn = document.getElementById("copyBtn");
const saveBtn = document.getElementById("saveBtn");
const likeBtn = document.getElementById("likeBtn");
const repeatBtn = document.getElementById("repeatBtn");
const noRepeatToggle = document.getElementById("noRepeatToggle");
const themeToggle = document.getElementById("themeToggle");
const savedList = document.getElementById("savedList");

applyTheme();
syncControls();
init();

revealBtn.addEventListener("click", reveal);
copyBtn.addEventListener("click", copyCurrentMessage);
saveBtn.addEventListener("click", saveCurrentMessage);
likeBtn.addEventListener("click", toggleLike);
repeatBtn.addEventListener("click", toggleRepeat);
noRepeatToggle.addEventListener("change", toggleNoRepeat);
themeToggle.addEventListener("change", toggleTheme);

async function init() {
  await loadPoolAndFeedback();
  syncControls();
}

// ---------- ID helper ----------
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return "seed-" + Math.abs(h).toString(36);
}

function newId() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

// ---------- Local state persistence ----------
function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return normalizeState({ ...initialState, ...parsed });
  } catch {
    return normalizeState(initialState);
  }
}

function normalizeQuote(value) {
  if (typeof value === "string") return { text: value };
  if (!value || typeof value !== "object") return { text: "" };
  return {
    id: value.id,
    kind: value.kind || "quote",
    text: String(value.text || ""),
    ...(value.author ? { author: String(value.author) } : {}),
    ...(value.url ? { url: String(value.url) } : {}),
    ...(value.platform ? { platform: String(value.platform) } : {})
  };
}

function normalizeState(value) {
  return {
    ...initialState,
    ...value,
    currentItem: value.currentItem ? normalizeQuote(value.currentItem) : null,
    savedMessages: Array.isArray(value.savedMessages)
      ? value.savedMessages.map(normalizeQuote).filter(q => q.text || q.url)
      : [],
    viewedIds: Array.isArray(value.viewedIds) ? value.viewedIds : []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- Backend I/O ----------
async function fetchBackendRows() {
  const response = await fetch(`${API_URL}?userId=${encodeURIComponent(USER_ID)}&token=${encodeURIComponent(AUTH_TOKEN)}`);
  const result = await response.json();
  if (!result.ok || !Array.isArray(result.data)) return [];
  return result.data;
}

async function postBackend(type, data) {
  try {
    const params = new URLSearchParams({ userId: USER_ID, type, data: JSON.stringify(data), token: AUTH_TOKEN });
    await fetch(`${API_URL}?${params.toString()}`, { method: "POST" });
  } catch (error) {
    console.warn(`Remote ${type} save unavailable:`, error);
  }
}

async function loadPoolAndFeedback() {
  let rows = [];
  try {
    rows = await fetchBackendRows();
  } catch (error) {
    console.warn("Backend unavailable:", error);
  }

  const backendItems = rows
    .filter(r => r.type === "boost_item" && r.data)
    .map(r => normalizeQuote(r.data))
    .filter(q => q.id && (q.text || q.url));

  const uniqueById = {};
  backendItems.forEach(item => { uniqueById[item.id] = item; });
  boostPool = Object.values(uniqueById);

  feedbackMap = {};
  rows
    .filter(r => r.type === "boost_feedback" && r.data)
    .forEach(r => {
      const f = r.data;
      if (f && f.itemId) feedbackMap[f.itemId] = f;
    });

  const alreadyMigrated = localStorage.getItem(SEED_FLAG_KEY) === "true";
  if (!alreadyMigrated) {
    await seedFromLocal();
  }
}

async function seedFromLocal() {
  try {
    const response = await fetch(LOCAL_SEED_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Seed request failed: ${response.status}`);
    const days = await response.json();
    const existingIds = new Set(boostPool.map(i => i.id));
    const seedItems = [];
    days.forEach(day => {
      (day.quotes || []).forEach(q => {
        const id = hashId(`${q.text}|${q.author || ""}`);
        if (existingIds.has(id)) return;
        seedItems.push({ id, kind: "quote", text: q.text, author: q.author || null, source: "import", addedAt: new Date().toISOString() });
      });
    });

    boostPool = boostPool.concat(seedItems);
    localStorage.setItem(SEED_FLAG_KEY, "true");
    seedItems.forEach(item => postBackend("boost_item", item));
  } catch (error) {
    console.warn("Local seed content unavailable:", error);
  }
}

function persistFeedback(itemId) {
  const f = feedbackMap[itemId];
  if (!f) return;
  postBackend("boost_feedback", { ...f, itemId, updatedAt: new Date().toISOString() });
}

// ---------- Picking ----------
function pickItem() {
  if (boostPool.length === 0) return null;

  const repeatIds = new Set(Object.keys(feedbackMap).filter(id => feedbackMap[id] && feedbackMap[id].repeatRequested));

  let candidates = boostPool.filter(item => repeatIds.has(item.id) || !state.viewedIds.includes(item.id));
  if (candidates.length === 0) {
    state.viewedIds = [];
    status.innerText = "Today's cycle is complete. Starting a fresh set.";
    candidates = boostPool;
  }

  const weighted = [];
  candidates.forEach(item => {
    const weight = repeatIds.has(item.id) ? 3 : 1;
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  const pick = weighted[Math.floor(Math.random() * weighted.length)];

  if (!repeatIds.has(pick.id) && !state.viewedIds.includes(pick.id)) {
    state.viewedIds.push(pick.id);
  }

  return pick;
}

// ---------- Reveal / render ----------
function reveal() {
  if (boostPool.length === 0) {
    status.innerText = "No Daily Boost content is available yet.";
    return;
  }

  const item = pickItem();
  if (!item) return;
  state.currentItem = item;

  if (feedbackMap[item.id] && feedbackMap[item.id].repeatRequested) {
    const f = feedbackMap[item.id];
    f.timesShown = (f.timesShown || 0) + 1;
    persistFeedback(item.id);
  }

  renderCurrentMessage();
  output.focus();
  syncSaveButton();
  syncFeedbackButtons();

  if (!status.innerText.startsWith("Today's cycle")) {
    status.innerText = "New reveal!";
  }

  saveState();
}

function renderCurrentMessage() {
  const item = state.currentItem;
  if (!item) {
    boostText.innerText = "Press reveal to get a message 👇";
    boostAuthor.hidden = true;
    boostLink.hidden = true;
    boostLinkLabel.hidden = true;
    repeatStats.hidden = true;
    return;
  }

  if (item.kind === "link") {
    boostText.innerText = item.text || "Tap to view";
    boostAuthor.hidden = !item.platform;
    if (item.platform) boostAuthor.innerText = `— via ${capitalize(item.platform)}`;
    const hasUrl = Boolean(item.url);
    boostLink.hidden = !hasUrl;
    boostLinkLabel.hidden = !hasUrl;
    if (item.url) boostLink.href = item.url;
  } else {
    boostText.innerText = item.text || "";
    if (item.author) {
      boostAuthor.hidden = false;
      boostAuthor.innerText = `— ${item.author}`;
    } else {
      boostAuthor.hidden = true;
    }
    boostLink.hidden = true;
    boostLinkLabel.hidden = true;
  }

  renderRepeatStats(item.id);
}

function renderRepeatStats(itemId) {
  const f = feedbackMap[itemId];
  if (f && f.repeatRequested) {
    const since = f.repeatSince ? new Date(f.repeatSince).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    repeatStats.hidden = false;
    repeatStats.innerText = `🔁 Repeating • shown ${f.timesShown || 0}× since ${since}`;
  } else {
    repeatStats.hidden = true;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Feedback (like / repeat) ----------
function toggleLike() {
  const item = state.currentItem;
  if (!item || !item.id) return;
  const f = feedbackMap[item.id] || { itemId: item.id, liked: false, repeatRequested: false, timesShown: 0 };
  f.liked = !f.liked;
  feedbackMap[item.id] = f;
  syncFeedbackButtons();
  persistFeedback(item.id);
}

function toggleRepeat() {
  const item = state.currentItem;
  if (!item || !item.id) return;
  const f = feedbackMap[item.id] || { itemId: item.id, liked: false, repeatRequested: false, timesShown: 0 };
  f.repeatRequested = !f.repeatRequested;
  if (f.repeatRequested) {
    f.repeatSince = new Date().toISOString();
    f.timesShown = 0;
  } else {
    f.repeatSince = null;
    f.timesShown = 0;
  }
  feedbackMap[item.id] = f;
  syncFeedbackButtons();
  renderRepeatStats(item.id);
  persistFeedback(item.id);
}

function syncFeedbackButtons() {
  const item = state.currentItem;
  const f = item ? feedbackMap[item.id] : null;
  const liked = Boolean(f && f.liked);
  const repeating = Boolean(f && f.repeatRequested);
  likeBtn.setAttribute("aria-pressed", String(liked));
  likeBtn.innerText = liked ? "❤ Liked" : "🤍 Like";
  repeatBtn.setAttribute("aria-pressed", String(repeating));
  repeatBtn.innerText = repeating ? "🔁 Repeating" : "🔁 Repeat";
}

// ---------- Copy / Save ----------
async function copyCurrentMessage() {
  const item = state.currentItem;
  if (!item || (!item.text && !item.url)) {
    status.innerText = "Nothing to copy yet.";
    return;
  }

  let copyText;
  if (item.kind === "link") {
    copyText = item.text ? `${item.text}\n${item.url}` : item.url;
  } else {
    copyText = item.author ? `${item.text}\n— ${item.author}` : item.text;
  }

  try {
    await navigator.clipboard.writeText(copyText);
    status.innerText = "Message copied to clipboard.";
  } catch {
    status.innerText = "Clipboard unavailable in this browser.";
  }
}

function saveCurrentMessage() {
  const item = state.currentItem;
  if (!item || (!item.text && !item.url)) {
    status.innerText = "Reveal a message first.";
    return;
  }

  const exists = state.savedMessages.some(saved => saved.id === item.id);
  if (!exists) {
    state.savedMessages.unshift(item);
    if (state.savedMessages.length > 8) state.savedMessages = state.savedMessages.slice(0, 8);
    renderSavedMessages();
    saveState();
    status.innerText = "Saved to your list.";
  } else {
    status.innerText = "Already in your saved list.";
  }

  syncSaveButton();
}

function renderSavedMessages() {
  savedList.innerHTML = "";

  if (state.savedMessages.length === 0) {
    const empty = document.createElement("li");
    empty.innerText = "No saved messages yet.";
    empty.className = "saved-item";
    savedList.appendChild(empty);
    return;
  }

  state.savedMessages.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "saved-item";
    const row = document.createElement("div");
    row.className = "saved-item-row";
    const textWrap = document.createElement("div");
    textWrap.className = "saved-item-text";
    const text = document.createElement("span");
    text.innerText = item.text || item.url;
    textWrap.appendChild(text);
    if (item.author) {
      const author = document.createElement("span");
      author.className = "saved-author";
      author.innerText = `— ${item.author}`;
      textWrap.appendChild(author);
    }
    row.appendChild(textWrap);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "saved-remove-btn";
    removeBtn.setAttribute("aria-label", "Remove saved message");
    removeBtn.innerText = "✕";
    removeBtn.addEventListener("click", () => removeSavedMessage(index));
    row.appendChild(removeBtn);
    li.appendChild(row);
    savedList.appendChild(li);
  });
}

function removeSavedMessage(index) {
  state.savedMessages.splice(index, 1);
  renderSavedMessages();
  syncSaveButton();
  saveState();
  status.innerText = "Removed from saved list.";
}

function syncSaveButton() {
  const item = state.currentItem;
  const isSaved = Boolean(item) && state.savedMessages.some(saved => saved.id === item.id);
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.innerText = isSaved ? "Saved" : "Save";
}

// ---------- Controls ----------
function syncControls() {
  renderCurrentMessage();
  noRepeatToggle.checked = state.noRepeat;
  themeToggle.checked = state.darkMode;
  renderSavedMessages();
  syncSaveButton();
  syncFeedbackButtons();
}

function toggleNoRepeat() {
  state.noRepeat = noRepeatToggle.checked;
  if (!state.noRepeat) state.viewedIds = [];
  status.innerText = state.noRepeat ? "No-repeat mode on." : "No-repeat mode off.";
  saveState();
}

function toggleTheme() {
  state.darkMode = themeToggle.checked;
  applyTheme();
  saveState();
}

function applyTheme() {
  document.body.classList.toggle("dark", Boolean(state.darkMode));
}
