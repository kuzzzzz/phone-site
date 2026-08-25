const STORAGE_KEY = "pulseLogEntries";

const DIMS = [
  { key: "mood", label: "Mood", color: "#e0577b" },
  { key: "energy", label: "Energy", color: "#e0a83a" },
  { key: "focus", label: "Focus", color: "#2fa89a" }
];
const BUCKETS = [
  { key: "morning", label: "Morning", range: [5, 11] },
  { key: "afternoon", label: "Afternoon", range: [12, 16] },
  { key: "evening", label: "Evening", range: [17, 21] },
  { key: "night", label: "Night", range: [22, 4] }
];

let values = { mood: 3, energy: 3, focus: 3 };

PhoneSite.applyThemeFromStorage();
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.checked = PhoneSite.getDarkMode();
  themeToggle.addEventListener("change", () => {
    PhoneSite.setDarkMode(themeToggle.checked);
  });
}

async function saveNoteAsBoost() {
  const noteEl = document.getElementById("note");
  const text = noteEl.value.trim();
  const boostMsg = document.getElementById("boost-msg");
  if (!text) {
    boostMsg.textContent = "Write a note first.";
    boostMsg.style.color = "#e0577b";
    setTimeout(() => {
      boostMsg.textContent = "";
    }, 1800);
    return;
  }

  const item = {
    id: PhoneSite.newId(),
    kind: "quote",
    text,
    author: null,
    source: "pulse",
    loggedAt: new Date().toISOString(),
    addedAt: new Date().toISOString()
  };

  const result = await PhoneSite.postBackend("boost_item", item);
  if (result.ok) {
    boostMsg.textContent = "Saved to Daily Boost";
    boostMsg.style.color = "#2fa89a";
  } else {
    boostMsg.textContent = "Queued — will sync when online";
    boostMsg.style.color = "#e0a83a";
  }
  setTimeout(() => {
    boostMsg.textContent = "";
  }, 2200);
}

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveEntries(entries, syncRemote = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  if (syncRemote) syncEntriesToBackend(entries);
}

async function syncEntriesToBackend(entries) {
  const latest = entries[entries.length - 1];
  if (!latest) return;
  await PhoneSite.postBackend("pulse_entry", latest);
}

async function syncFromBackend() {
  try {
    const rows = await PhoneSite.fetchBackendRows();
    const remoteEntries = rows
      .filter(item => item.type === "pulse_entry" && item.data)
      .map(item => item.data)
      .filter(e => e.timestamp);

    if (remoteEntries.length === 0) return;

    const existing = loadEntries();
    const merged = [...existing];
    const seen = new Set(merged.map(e => e.timestamp));

    remoteEntries.forEach(entry => {
      if (!seen.has(entry.timestamp)) {
        merged.push(entry);
        seen.add(entry.timestamp);
      }
    });

    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    renderAll();
  } catch (error) {
    console.warn("Remote Pulse sync unavailable:", error);
  }
}

function bucketFor(hour) {
  for (const b of BUCKETS) {
    const [start, end] = b.range;
    if (start <= end) {
      if (hour >= start && hour <= end) return b.key;
    } else if (hour >= start || hour <= end) {
      return b.key;
    }
  }
  return "night";
}

function renderSliders() {
  const el = document.getElementById("sliders");
  el.innerHTML = DIMS.map(
    d => `
    <div class="slider-row">
      <div class="row-top">
        <label for="${d.key}">${d.label}</label>
        <span id="${d.key}-out">${values[d.key]}</span>
      </div>
      <input type="range" id="${d.key}" min="1" max="5" step="1" value="${values[d.key]}"
        aria-valuemin="1" aria-valuemax="5" aria-valuenow="${values[d.key]}" />
    </div>
  `
  ).join("");
  DIMS.forEach(d => {
    const input = document.getElementById(d.key);
    input.addEventListener("input", e => {
      values[d.key] = Number(e.target.value);
      document.getElementById(d.key + "-out").textContent = values[d.key];
      input.setAttribute("aria-valuenow", String(values[d.key]));
    });
  });
}

function timeLabel() {
  const now = new Date();
  document.getElementById("time-label").textContent = now.toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit"
  });
}

function logEntry() {
  const now = new Date();
  const entry = {
    mood: values.mood,
    energy: values.energy,
    focus: values.focus,
    note: document.getElementById("note").value.trim(),
    timestamp: now.toISOString(),
    hour: now.getHours()
  };
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  document.getElementById("note").value = "";
  const msg = document.getElementById("saved-msg");
  msg.textContent = "Saved";
  msg.style.color = "#2fa89a";
  setTimeout(() => {
    msg.textContent = "";
  }, 1500);
  renderAll();
}

function renderChart(entries) {
  const chartEl = document.getElementById("chart");
  const emptyEl = document.getElementById("chart-empty");
  if (entries.length < 3) {
    chartEl.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }
  chartEl.style.display = "block";
  emptyEl.style.display = "none";

  const grouped = {};
  BUCKETS.forEach(b => {
    grouped[b.key] = { mood: [], energy: [], focus: [] };
  });
  entries.forEach(e => {
    const b = bucketFor(e.hour);
    grouped[b].mood.push(e.mood);
    grouped[b].energy.push(e.energy);
    grouped[b].focus.push(e.focus);
  });

  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  chartEl.innerHTML = BUCKETS.map(b => {
    const g = grouped[b.key];
    const count = g.mood.length;
    if (count === 0) {
      return `<div class="empty-note" style="margin-bottom:10px;">${b.label} — no entries yet</div>`;
    }
    const bars = DIMS.map(d => {
      const a = avg(g[d.key]);
      const pct = Math.round((a / 5) * 100);
      return `
        <div class="bar-row">
          <span class="label">${d.label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${d.color};"></div></div>
          <span class="bar-val">${a.toFixed(1)}</span>
        </div>`;
    }).join("");
    return `
      <div class="bucket">
        <div class="bucket-head"><span>${b.label}</span><span class="count">${count} ${count === 1 ? "entry" : "entries"}</span></div>
        ${bars}
      </div>`;
  }).join("");
}

function renderHistory(entries) {
  const el = document.getElementById("history");
  if (entries.length === 0) {
    el.innerHTML = "";
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "No entries yet — log your first one above.";
    el.appendChild(p);
    return;
  }
  el.innerHTML = "";
  const recent = entries.slice().reverse().slice(0, 8);
  recent.forEach(e => {
    const d = new Date(e.timestamp);
    const label = d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
    const row = document.createElement("div");
    row.className = "history-row";
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = label;
    const m = document.createElement("span");
    m.className = "m";
    m.textContent = `M ${e.mood} · E ${e.energy} · F ${e.focus}`;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = e.note || "";
    row.appendChild(t);
    row.appendChild(m);
    row.appendChild(n);
    el.appendChild(row);
  });
}

function exportCsv() {
  const entries = loadEntries();
  if (entries.length === 0) return;
  const header = ["timestamp", "hour", "mood", "energy", "focus", "note"];
  const escapeCell = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = entries.map(e => header.map(h => escapeCell(e[h])).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pulse-log-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseLine = line => {
    const cells = [];
    let cur = "",
      inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          cur += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          cells.push(cur);
          cur = "";
        } else cur += c;
      }
    }
    cells.push(cur);
    return cells;
  };
  const header = parseLine(lines[0]).map(h => h.trim());
  return lines
    .slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cells = parseLine(line);
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = cells[i];
      });
      return {
        timestamp: obj.timestamp,
        hour: Number(obj.hour),
        mood: Number(obj.mood),
        energy: Number(obj.energy),
        focus: Number(obj.focus),
        note: obj.note || ""
      };
    });
}

function importCsvFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const msg = document.getElementById("import-msg");
    try {
      const imported = parseCsv(reader.result);
      if (imported.length === 0) throw new Error("empty");
      const existing = loadEntries();
      const seen = new Set(existing.map(e => e.timestamp));
      let added = 0;
      imported.forEach(e => {
        if (e.timestamp && !seen.has(e.timestamp)) {
          existing.push(e);
          seen.add(e.timestamp);
          added++;
        }
      });
      saveEntries(existing, false);
      imported.forEach(e => PhoneSite.postBackend("pulse_entry", e));
      msg.style.color = "#2fa89a";
      msg.textContent = `Imported ${added} new ${added === 1 ? "entry" : "entries"} (${imported.length - added} already present, skipped).`;
      renderAll();
    } catch (err) {
      msg.style.color = "#e0577b";
      msg.textContent = "Couldn't read that file — make sure it's a CSV exported from Pulse Log.";
    }
  };
  reader.readAsText(file);
}

function renderAll() {
  const entries = loadEntries()
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  renderChart(entries);
  renderHistory(entries);
}

renderSliders();
timeLabel();
document.getElementById("log-btn").addEventListener("click", logEntry);
document.getElementById("boost-btn").addEventListener("click", saveNoteAsBoost);
document.getElementById("export-btn").addEventListener("click", exportCsv);
document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});
document.getElementById("import-file").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) importCsvFile(file);
  e.target.value = "";
});
renderAll();
PhoneSite.flushOutbox().then(() => syncFromBackend());
