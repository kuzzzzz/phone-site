const messages = [
  "Your breakthrough is closer than your birthday 🎁",
  "That stress you're carrying? It will pay you back double 💙",
  "Unexpected money is coming… stay ready 💸",
  "Someone quietly respects you more than you know 🌟",
  "Your next chapter is healing, clarity and success 💫",
  "Your name go soon appear where it matters 🔥",
  "Peace is coming back into your life slowly 🕊️",
  "Your vibe is rare. Protect it ❤️",
  "Your future self is already proud of you ✨",
  "A sweet surprise go land this week 📩"
];

const STORAGE_KEY = "tap-to-reveal-state";

const output = document.getElementById("output");
const status = document.getElementById("status");
const revealBtn = document.getElementById("revealBtn");
const copyBtn = document.getElementById("copyBtn");
const saveBtn = document.getElementById("saveBtn");
const noRepeatToggle = document.getElementById("noRepeatToggle");
const themeToggle = document.getElementById("themeToggle");
const savedList = document.getElementById("savedList");

const initialState = {
  currentMessage: output.innerText,
  savedMessages: [],
  viewedIndexes: [],
  noRepeat: true,
  darkMode: false
};

let state = loadState();
applyTheme();
renderSavedMessages();
syncControls();

revealBtn.addEventListener("click", reveal);
copyBtn.addEventListener("click", copyCurrentMessage);
saveBtn.addEventListener("click", saveCurrentMessage);
noRepeatToggle.addEventListener("change", toggleNoRepeat);
themeToggle.addEventListener("change", toggleTheme);

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...initialState,
      ...parsed,
      savedMessages: Array.isArray(parsed.savedMessages) ? parsed.savedMessages : [],
      viewedIndexes: Array.isArray(parsed.viewedIndexes) ? parsed.viewedIndexes : []
    };
  } catch {
    return { ...initialState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncControls() {
  output.innerText = state.currentMessage;
  noRepeatToggle.checked = state.noRepeat;
  themeToggle.checked = state.darkMode;
  syncSaveButton();
}

function reveal() {
  const idx = pickMessageIndex();
  state.currentMessage = messages[idx];

  if (state.noRepeat && !state.viewedIndexes.includes(idx)) {
    state.viewedIndexes.push(idx);
  }

  output.innerText = state.currentMessage;
  output.focus();
  syncSaveButton();

  const remaining = Math.max(messages.length - state.viewedIndexes.length, 0);
  status.innerText =
    state.noRepeat ? `New reveal! ${remaining} unique message(s) left in this cycle.` : "New reveal!";

  saveState();
}

function pickMessageIndex() {
  if (!state.noRepeat) {
    return Math.floor(Math.random() * messages.length);
  }

  const unseenIndexes = messages
    .map((_, i) => i)
    .filter((i) => !state.viewedIndexes.includes(i));

  if (unseenIndexes.length === 0) {
    state.viewedIndexes = [];
    status.innerText = "Cycle complete. Starting fresh set of reveals.";
    return Math.floor(Math.random() * messages.length);
  }

  const randomSlot = Math.floor(Math.random() * unseenIndexes.length);
  return unseenIndexes[randomSlot];
}

async function copyCurrentMessage() {
  if (!state.currentMessage) {
    status.innerText = "Nothing to copy yet.";
    return;
  }

  try {
    await navigator.clipboard.writeText(state.currentMessage);
    status.innerText = "Message copied to clipboard.";
  } catch {
    status.innerText = "Clipboard unavailable in this browser.";
  }
}

function saveCurrentMessage() {
  if (!state.currentMessage) {
    status.innerText = "Reveal a message first.";
    return;
  }

  if (!state.savedMessages.includes(state.currentMessage)) {
    state.savedMessages.unshift(state.currentMessage);
    if (state.savedMessages.length > 8) {
      state.savedMessages = state.savedMessages.slice(0, 8);
    }
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
    empty.style.listStyle = "none";
    empty.style.marginLeft = "-20px";
    savedList.appendChild(empty);
    return;
  }

  state.savedMessages.forEach((msg) => {
    const li = document.createElement("li");
    li.innerText = msg;
    savedList.appendChild(li);
  });
}

function toggleNoRepeat() {
  state.noRepeat = noRepeatToggle.checked;
  if (!state.noRepeat) {
    state.viewedIndexes = [];
  }
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
  const isSaved = state.savedMessages.includes(state.currentMessage);
  saveBtn.setAttribute("aria-pressed", String(isSaved));
  saveBtn.innerText = isSaved ? "Saved" : "Save";
}
