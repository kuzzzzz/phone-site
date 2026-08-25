const kindQuoteBtn = document.getElementById("kindQuoteBtn");
const kindLinkBtn = document.getElementById("kindLinkBtn");
const quoteFields = document.getElementById("quoteFields");
const linkFields = document.getElementById("linkFields");
const quoteText = document.getElementById("quoteText");
const quoteAuthor = document.getElementById("quoteAuthor");
const linkUrl = document.getElementById("linkUrl");
const linkCaption = document.getElementById("linkCaption");
const platformHint = document.getElementById("platformHint");
const submitBtn = document.getElementById("submitBtn");
const status = document.getElementById("status");

let kind = "quote";

PhoneSite.applyThemeFromStorage();
PhoneSite.flushOutbox();

kindQuoteBtn.addEventListener("click", () => setKind("quote"));
kindLinkBtn.addEventListener("click", () => setKind("link"));
linkUrl.addEventListener("input", updatePlatformHint);
submitBtn.addEventListener("click", submit);

function setKind(next) {
  kind = next;
  kindQuoteBtn.classList.toggle("primary", kind === "quote");
  kindQuoteBtn.setAttribute("aria-pressed", String(kind === "quote"));
  kindLinkBtn.classList.toggle("primary", kind === "link");
  kindLinkBtn.setAttribute("aria-pressed", String(kind === "link"));
  quoteFields.hidden = kind !== "quote";
  linkFields.hidden = kind !== "link";
  status.innerText = "";
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    if (host.includes("twitter.com") || host.includes("x.com")) return "twitter";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("instagram.com")) return "instagram";
    return null;
  } catch {
    return null;
  }
}

function updatePlatformHint() {
  const platform = detectPlatform(linkUrl.value.trim());
  platformHint.innerText = platform
    ? `Detected: ${platform}`
    : linkUrl.value.trim()
      ? "Platform not recognized — will save as a generic link."
      : "";
}

async function submit() {
  let item;

  if (kind === "quote") {
    const text = quoteText.value.trim();
    if (!text) {
      status.innerText = "Add some quote text first.";
      return;
    }
    item = {
      id: PhoneSite.newId(),
      kind: "quote",
      text,
      author: quoteAuthor.value.trim() || null,
      source: "admin",
      addedAt: new Date().toISOString()
    };
  } else {
    const url = linkUrl.value.trim();
    if (!url) {
      status.innerText = "Add a link first.";
      return;
    }
    item = {
      id: PhoneSite.newId(),
      kind: "link",
      text: linkCaption.value.trim() || null,
      url,
      platform: detectPlatform(url),
      source: "admin",
      addedAt: new Date().toISOString()
    };
  }

  submitBtn.disabled = true;
  status.innerText = "Saving...";

  const result = await PhoneSite.postBackend("boost_item", item);
  if (result.ok) {
    status.innerText = "Added! It'll show up in your Daily Boost rotation.";
    quoteText.value = "";
    quoteAuthor.value = "";
    linkUrl.value = "";
    linkCaption.value = "";
    platformHint.innerText = "";
  } else {
    status.innerText = "Couldn't reach the server — queued to retry when you're back online.";
  }
  submitBtn.disabled = false;
}
