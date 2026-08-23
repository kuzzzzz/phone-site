const API_URL = "https://script.google.com/macros/s/AKfycbypa1N6yeEjTURZE-5_krWUUdEHqDfi_pjXKRNa9YvigIAMa6ny6NSfychr8QA4gpdn/exec";
const USER_ID = "phone-site-primary";
const CONTENT_URL = "./daily_boost_week1.json";
const STORAGE_KEY = "tap-to-reveal-state";

let dailyContent = [];
let state = loadState();

const output = document.getElementById("output");
const boostText = document.getElementById("boostText");
const boostAuthor = document.getElementById("boostAuthor");
const status = document.getElementById("status");
const revealBtn = document.getElementById("revealBtn");
const copyBtn = document.getElementById("copyBtn");
const saveBtn = document.getElementById("saveBtn");
const noRepeatToggle = document.getElementById("noRepeatToggle");
const themeToggle = document.getElementById("themeToggle");
const savedList = document.getElementById("savedList");

const initialState = {
  currentMessage: { text: "Press reveal to get a message 👇" },
  savedMessages: [],
  viewedIndexes: [],
  noRepeat: true,
  darkMode: false,
  currentDay: null
};

applyTheme();
syncControls();
loadContent();
syncFromBackend();

revealBtn.addEventListener("click", reveal);
copyBtn.addEventListener("click", copyCurrentMessage);
saveBtn.addEventListener("click", saveCurrentMessage);
noRepeatToggle.addEventListener("change", toggleNoRepeat);
themeToggle.addEventListener("change", toggleTheme);

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return normalizeState({ ...initialState, ...parsed });
  } catch {
    return { ...initialState };
  }
}

function normalizeQuote(value) {
  if (typeof value === "string") return { text: value };
  if (!value || typeof value !== "object") return { text: "" };
  return {
    text: String(value.text || ""),
    ...(value.author ? { author: String(value.author) } : {})
  };
}

function normalizeState(value) {
  return {
    ...initialState,
    ...value,
    currentMessage: normalizeQuote(value.currentMessage),
    savedMessages: Array.isArray(value.savedMessages)
      ? value.savedMessages.map(normalizeQuote).filter(q => q.text)
      : [],
    viewedIndexes: Array.isArray(value.viewedIndexes) ? value.viewedIndexes : []
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncToBackend();
}

async function loadContent() {
  try {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    dailyContent = await response.json();
    ensureCurrentDay();
    syncControls();
  } catch (error) {
    console.warn("Daily Boost content unavailable:", error);
    status.innerText = "Daily Boost content could not be loaded.";
  }
}

function getDayNumber() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function ensureCurrentDay() {
  const today = getDayNumber();
  if (state.currentDay !== today) {
    state.currentDay = today;
    state.viewedIndexes = [];
    state.currentMessage = { text: "Press reveal to get a message 👇" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function getTodayQuotes() {
  const day = dailyContent.find(item => Number(item.day) === Number(state.currentDay || getDayNumber()));
  return Array.isArray(day?.quotes) ? day.quotes.map(normalizeQuote).filter(q => q.text) : [];
}

async function syncFromBackend() {
  try {
    const response = await fetch(`${API_URL}?userId=${encodeURIComponent(USER_ID)}`);
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.data)) return;

    const remote = result.data.filter(item => item.type === "boost_state" && item.data).at(-1);
    if (!remote) return;

    const remoteState = normalizeState(remote.data);
    state = normalizeState({ ...state, ...remoteState });
    ensureCurrentDay();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyTheme();
    renderSavedMessages();
    syncControls();
  } catch (error) {
    console.warn("Remote Daily Boost sync unavailable:", error);
  }
}

async function syncToBackend() {
  try {
    const params = new URLSearchParams({
      userId: USER_ID,
      type: "boost_state",
      data: JSON.stringify(state)
    });
    await fetch(`${API_URL}?${params.toString()}`, { method: "POST" });
  } catch (error) {
    console.warn("Remote Daily Boost save unavailable:", error);
  }
}

function syncControls() {
  renderCurrentMessage();
  noRepeatToggle.checked = state.noRepeat;
  themeToggle.checked = state.darkMode;
  renderSavedMessages();
  syncSaveButton();
}

function renderCurrentMessage() {
  const quote = normalizeQuote(state.currentMessage);
  boostText.innerText = quote.text || "Press reveal to get a message 👇";
  if (quote.author) {
    boostAuthor.hidden = false;
    boostAuthor.innerText = `— ${quote.author}`;
  } else {
    boostAuthor.hidden = true;
    boostAuthor.innerText = "";
  }
}

function reveal() {
  const quotes = getTodayQuotes();
  if (quotes.length === 0) {
    status.innerText = "No Daily Boost content is available for today.";
    return;
  }

  const idx = pickMessageIndex(quotes);
  state.currentMessage = quotes[idx];

  if (state.noRepeat && !state.viewedIndexes.includes(idx)) {
    state.viewedIndexes.push(idx);
  }

  renderCurrentMessage();
  output.focus();
  syncSaveButton();

  const remaining = Math.max(quotes.length - state.viewedIndexes.length, 0);
  status.innerText = state.noRepeat
    ? `New reveal! ${remaining} unique message(s) left today.`
    : "New reveal!";

  saveState();
}

function pickMessageIndex(quotes) {
  if (!state.noRepeat) return Math.floor(Math.random() * quotes.length);

  const unseenIndexes = quotes
    .map((_, i) => i)
    .filter(i => !state.viewedIndexes.includes(i));

  if (unseenIndexes.length === 0) {
    state.viewedIndexes = [];
    status.innerText = "Today's cycle is complete. Starting a fresh set.";
    return Math.floor(Math.random() * quotes.length);
  }

  return unseenIndexes[Math.floor(Math.random() * unseenIndexes.length)];
}

async function copyCurrentMessage() {
  const quote = normalizeQuote(state.currentMessage);
  if (!quote.text || quote.text.startsWith("Press reveal")) {
    status.innerText = "Nothing to copy yet.";
    return;
  }

  const copyText = quote.author ? `${quote.text}\n— ${quote.author}` : quote.text;
  try {
    await navigator.clipboard.writeText(copyText);
    status.innerText = "Message copied to clipboard.";
  } catch {
    status.innerText = "Clipboard unavailable in this browser.";
  }
}

function saveCurrentMessage() {
  const quote = normalizeQuote(state.currentMessage);
  if (!quote.text || quote.text.startsWith("Press reveal")) {
    status.innerText = "Reveal a message first.";
    return;
  }

  const exists = state.savedMessages.some(saved => saved.text === quote.text && saved.author === quote.author);
  if (!exists) {
    state.savedMessages.unshift(quote);
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

  state.savedMessages.forEach(quote => {
    const li = document.createElement("li");
    li.className = "saved-item";
    const text = document.createElement("span");
    text.innerText = quote.text;
    li.appendChild(text);
    if (quote.author) {
      const author = document.createElement("span");
      author.className = "saved-author";
      author.innerText = `— ${quote.author}`;
      li.appendChild(author);
    }
    savedList.appendChild(li);
  });
}

function toggleNoRepeat() {
  state.noRepeat = noRepeatToggle.checked;
  if (!state.noRepeat) state.viewedIndexes = [];
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

function syncSaveButton() {
  const current = normalizeQuote(state.currentMessage);
  const isSaved = state.savedMessages.some(saved => saved.text === current.text && saved.author === current.author);
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.innerText = isSaved ? "Saved" : "Save";
}
