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
let statusPriority = 0;

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

state.darkMode = PhoneSite.getDarkMode();
PhoneSite.applyThemeFromStorage();
syncControls();
setStatus("Loading boosts…", 1);
init();

revealBtn.addEventListener("click", reveal);
copyBtn.addEventListener("click", copyCurrentMessage);
saveBtn.addEventListener("click", saveCurrentMessage);
likeBtn.addEventListener("click", toggleLike);
repeatBtn.addEventListener("click", toggleRepeat);
noRepeatToggle.addEventListener("change", toggleNoRepeat);
themeToggle.addEventListener("change", toggleTheme);

async function init() {
  await PhoneSite.flushOutbox();
  await loadPoolAndFeedback();
  syncControls();
  if (boostPool.length === 0) {
    setStatus("No Daily Boost content is available yet.", 2);
  } else {
    setStatus("Ready — tap Reveal.", 1);
  }
}

function setStatus(message, priority = 0) {
  if (priority < statusPriority && status.innerText) return;
  statusPriority = priority;
  status.innerText = message || "";
  if (priority > 0) {
    setTimeout(() => {
      if (status.innerText === message) statusPriority = 0;
    }, 4000);
  }
}

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
    ...(value.platform ? { platform: String(value.platform) } : {}),
    ...(value.source ? { source: String(value.source) } : {}),
    ...(value.loggedAt ? { loggedAt: String(value.loggedAt) } : {})
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

async function loadPoolAndFeedback() {
  let rows = [];
  try {
    rows = await PhoneSite.fetchBackendRows();
  } catch (error) {
    console.warn("Backend unavailable:", error);
  }

  const backendItems = rows
    .filter(r => r.type === "boost_item" && r.data)
    .map(r => normalizeQuote(r.data))
    .filter(q => q.id && (q.text || q.url));

  const uniqueById = {};
  backendItems.forEach(item => {
    uniqueById[item.id] = item;
  });
  boostPool = Object.values(uniqueById);

  feedbackMap = {};
  rows
    .filter(r => r.type === "boost_feedback" && r.data)
    .forEach(r => {
      const f = r.data;
      if (!f || !f.itemId) return;
      const existing = feedbackMap[f.itemId];
      if (
        !existing ||
        (f.updatedAt && (!existing.updatedAt || String(f.updatedAt) > String(existing.updatedAt)))
      ) {
        feedbackMap[f.itemId] = f;
      }
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
        const id = PhoneSite.hashId(`${q.text}|${q.author || ""}`);
        if (existingIds.has(id)) return;
        seedItems.push({
          id,
          kind: "quote",
          text: q.text,
          author: q.author || null,
          source: "import",
          addedAt: new Date().toISOString()
        });
      });
    });

    boostPool = boostPool.concat(seedItems);
    localStorage.setItem(SEED_FLAG_KEY, "true");
    seedItems.forEach(item => PhoneSite.postBackend("boost_item", item));
  } catch (error) {
    console.warn("Local seed content unavailable:", error);
  }
}

function persistFeedback(itemId) {
  const f = feedbackMap[itemId];
  if (!f) return;
  PhoneSite.postBackend("boost_feedback", {
    ...f,
    itemId,
    updatedAt: new Date().toISOString()
  });
}

function pickItem() {
  if (boostPool.length === 0) return null;

  const repeatIds = new Set(
    Object.keys(feedbackMap).filter(id => feedbackMap[id] && feedbackMap[id].repeatRequested)
  );

  let candidates;
  if (state.noRepeat) {
    candidates = boostPool.filter(
      item => repeatIds.has(item.id) || !state.viewedIds.includes(item.id)
    );
    if (candidates.length === 0) {
      state.viewedIds = [];
      setStatus("Cycle complete. Starting a fresh set.", 3);
      candidates = boostPool.slice();
    }
  } else {
    candidates = boostPool.slice();
  }

  const weighted = [];
  candidates.forEach(item => {
    const weight = repeatIds.has(item.id) ? 3 : 1;
    for (let i = 0; i < weight; i++) weighted.push(item);
  });

  const pick = weighted[Math.floor(Math.random() * weighted.length)];

  if (state.noRepeat && !repeatIds.has(pick.id) && !state.viewedIds.includes(pick.id)) {
    state.viewedIds.push(pick.id);
  }

  return pick;
}

function reveal() {
  if (boostPool.length === 0) {
    setStatus("No Daily Boost content is available yet.", 2);
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

  if (statusPriority < 3) {
    setStatus("New reveal!", 1);
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
    const label = attributionLabel(item);
    if (label) {
      boostAuthor.hidden = false;
      boostAuthor.innerText = `— ${label}`;
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
    const since = f.repeatSince
      ? new Date(f.repeatSince).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "";
    repeatStats.hidden = false;
    repeatStats.innerText = `🔁 Repeating • shown ${f.timesShown || 0}× since ${since}`;
  } else {
    repeatStats.hidden = true;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function attributionLabel(item) {
  if (item.source === "pulse" && item.loggedAt) {
    const loggedDate = new Date(item.loggedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
    return `from your pulse log, ${loggedDate}`;
  }
  if (item.author) return item.author;
  return null;
}

function toggleLike() {
  const item = state.currentItem;
  if (!item || !item.id) return;
  const f = feedbackMap[item.id] || {
    itemId: item.id,
    liked: false,
    repeatRequested: false,
    timesShown: 0
  };
  f.liked = !f.liked;
  feedbackMap[item.id] = f;
  syncFeedbackButtons();
  persistFeedback(item.id);
}

function toggleRepeat() {
  const item = state.currentItem;
  if (!item || !item.id) return;
  const f = feedbackMap[item.id] || {
    itemId: item.id,
    liked: false,
    repeatRequested: false,
    timesShown: 0
  };
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

async function copyCurrentMessage() {
  const item = state.currentItem;
  if (!item || (!item.text && !item.url)) {
    setStatus("Nothing to copy yet.", 1);
    return;
  }

  let copyText;
  if (item.kind === "link") {
    copyText = item.text ? `${item.text}\n${item.url}` : item.url;
  } else {
    const label = attributionLabel(item);
    copyText = label ? `${item.text}\n— ${label}` : item.text;
  }

  try {
    await navigator.clipboard.writeText(copyText);
    setStatus("Message copied to clipboard.", 1);
  } catch {
    setStatus("Clipboard unavailable in this browser.", 1);
  }
}

function saveCurrentMessage() {
  const item = state.currentItem;
  if (!item || (!item.text && !item.url)) {
    setStatus("Reveal a message first.", 1);
    return;
  }

  const exists = state.savedMessages.some(saved => saved.id === item.id);
  if (!exists) {
    state.savedMessages.unshift(item);
    if (state.savedMessages.length > 8) state.savedMessages = state.savedMessages.slice(0, 8);
    renderSavedMessages();
    saveState();
    setStatus("Saved to your list.", 1);
  } else {
    setStatus("Already in your saved list.", 1);
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
    if (attributionLabel(item)) {
      const author = document.createElement("span");
      author.className = "saved-author";
      author.innerText = `— ${attributionLabel(item)}`;
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
  setStatus("Removed from saved list.", 1);
}

function syncSaveButton() {
  const item = state.currentItem;
  const isSaved = Boolean(item) && state.savedMessages.some(saved => saved.id === item.id);
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.innerText = isSaved ? "Saved" : "Save";
}

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
  setStatus(state.noRepeat ? "No-repeat mode on." : "No-repeat mode off — true random.", 1);
  saveState();
}

function toggleTheme() {
  state.darkMode = themeToggle.checked;
  PhoneSite.setDarkMode(state.darkMode);
  saveState();
}
