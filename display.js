// Read-only display, painted onto the desktop by Plash (macOS) or shown
// full-screen on a tablet / browser tab.
//
// Structure: a render() dispatcher picks a view renderer based on the synced
// display settings (controlled from the phone), and each renderer builds its
// own scaffold into #view-root over the same item data. Adding month / agenda
// views later is just another entry in VIEWS. The active view and what it
// shows (calendar / todo / both) come from store settings, not from this page —
// the wallpaper stays non-interactive.

import { config, CATEGORIES } from "./config.js";
import {
  getItems, onChange, MODE,
  getSettings, onSettingsChange, DEFAULT_SETTINGS,
} from "./store.js";
import {
  startOfWeek, addDays, sameDay, categoryById, priorityIcon,
  fmtTime, minutesOfDay,
} from "./util.js";

const $ = (sel) => document.querySelector(sel);

const HOUR_START = config.dayStartHour;
const HOUR_END = config.dayEndHour;
const TOTAL_MIN = (HOUR_END - HOUR_START) * 60;

function withAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function buildLegend() {
  $("#legend").innerHTML = CATEGORIES.map(
    (c) =>
      `<span class="legend-item"><span class="legend-dot" style="background:${c.color}"></span>${c.name}</span>`
  ).join("");
  $("#mode").textContent = MODE === "cloud" ? "synced" : "local only";
}

function days(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// Keep only the item types the current "show" mode displays. Orthogonal to the
// view: every renderer receives items already filtered this way.
function byMode(items, show) {
  if (show === "calendar") return items.filter((it) => it.type !== "todo");
  if (show === "todo") return items.filter((it) => it.type === "todo");
  return items;
}

// Place an item on a given day: returns {top%, height%} or null if it doesn't
// fall in the visible time window (those render in the all-day row instead).
function timedPosition(start, end) {
  const s = Math.max(minutesOfDay(start) - HOUR_START * 60, 0);
  const eMin = end ? minutesOfDay(end) : minutesOfDay(start) + 45;
  const e = Math.min(eMin - HOUR_START * 60, TOTAL_MIN);
  if (e <= 0 || s >= TOTAL_MIN) return null;
  const top = (s / TOTAL_MIN) * 100;
  const height = Math.max(((e - s) / TOTAL_MIN) * 100, 3.2);
  return { top, height };
}

function statusClass(item) {
  return item.status === "done"
    ? "status-done"
    : item.status === "doing"
    ? "status-doing"
    : "";
}

function eventEl(item, pos) {
  const cat = categoryById(item.category);
  const el = document.createElement("div");
  el.className = `event ${statusClass(item)}`;
  el.style.setProperty("--c", withAlpha(cat.color, 0.85));
  el.style.setProperty("--c-strong", cat.color);
  el.style.top = pos.top + "%";
  el.style.height = pos.height + "%";
  const start = new Date(item.start);
  el.innerHTML =
    `<div class="ev-title">` +
    `${item.status === "done" ? '<span class="check">✓</span> ' : ""}` +
    `<span>${escapeHtml(item.title)}</span>` +
    `<span class="prio">${priorityIcon(item.priority)}</span></div>` +
    `<div class="ev-time">${fmtTime(start)}</div>`;
  return el;
}

function chipEl(item) {
  const cat = categoryById(item.category);
  const el = document.createElement("div");
  el.className = `chip ${statusClass(item)}`;
  el.style.setProperty("--c", withAlpha(cat.color, 0.85));
  el.style.setProperty("--c-strong", cat.color);
  const box = item.type === "todo" ? (item.status === "done" ? "☑ " : "☐ ") : "";
  el.innerHTML =
    `<span class="chip-title">${box}${escapeHtml(item.title)}</span>` +
    `<span class="prio">${priorityIcon(item.priority)}</span>`;
  return el;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ── Week view ──────────────────────────────────────────────────────────────
function renderWeek(root, items) {
  const weekStart = startOfWeek(new Date());
  const weekDays = days(weekStart);
  const today = new Date();

  $("#range").textContent =
    weekStart.toLocaleDateString([], { month: "long", day: "numeric" }) +
    " – " +
    addDays(weekStart, 6).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  root.innerHTML =
    '<div id="allday-row" class="allday-row"><div class="allday-spacer"></div></div>' +
    '<div id="time-grid" class="time-grid">' +
    '<div id="hours" class="hours"></div>' +
    '<div id="days" class="days"></div>' +
    "</div>";

  const hours = root.querySelector("#hours");
  const days$ = root.querySelector("#days");
  const allday = root.querySelector("#allday-row");

  // Hour labels down the left gutter.
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const pct = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
    const lab = document.createElement("div");
    lab.className = "hour-label";
    lab.style.top = pct + "%";
    lab.textContent = (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "a" : "p");
    hours.appendChild(lab);
  }

  weekDays.forEach((day) => {
    const col = document.createElement("div");
    col.className = "day-col" + (sameDay(day, today) ? " today" : "");

    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML =
      `${day.toLocaleDateString([], { weekday: "short" })} ` +
      `<span class="dnum">${day.getDate()}</span>`;
    col.appendChild(head);

    for (let h = HOUR_START + 1; h < HOUR_END; h++) {
      const line = document.createElement("div");
      line.className = "hour-line";
      line.style.top = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100 + "%";
      col.appendChild(line);
    }

    // "Now" line on today's column.
    if (sameDay(day, today)) {
      const mins = minutesOfDay(today) - HOUR_START * 60;
      if (mins >= 0 && mins <= TOTAL_MIN) {
        const now = document.createElement("div");
        now.id = "now-line";
        now.style.top = (mins / TOTAL_MIN) * 100 + "%";
        col.appendChild(now);
      }
    }

    const alldayCell = document.createElement("div");
    alldayCell.className = "allday-cell";

    const dayItems = items.filter((it) => sameDay(new Date(it.start), day));
    for (const it of dayItems) {
      const start = new Date(it.start);
      const end = it.end ? new Date(it.end) : null;
      const timed = it.type === "event" && !it.all_day;
      const pos = timed ? timedPosition(start, end) : null;
      if (pos) col.appendChild(eventEl(it, pos));
      else alldayCell.appendChild(chipEl(it)); // todos, all-day, off-grid events
    }

    days$.appendChild(col);
    allday.appendChild(alldayCell);
  });

  const hasAny = items.some((it) =>
    weekDays.some((d) => sameDay(new Date(it.start), d))
  );
  if (!hasAny) {
    const empty = document.createElement("div");
    empty.id = "empty";
    empty.textContent = "Nothing scheduled this week — add something from your phone.";
    root.querySelector("#time-grid").appendChild(empty);
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────
// Map of view name → renderer. Day / month / agenda views slot in here.
const VIEWS = {
  week: renderWeek,
};

let allItems = [];
let settings = { ...DEFAULT_SETTINGS };

function render() {
  const renderer = VIEWS[settings.view] || renderWeek;
  renderer($("#view-root"), byMode(allItems, settings.show));
}

async function refresh() {
  try {
    allItems = await getItems();
  } catch (e) {
    console.error("load failed", e);
  }
  render();
}

async function main() {
  buildLegend();
  settings = await getSettings();
  await refresh();
  await onChange(refresh);
  // Phone flips the view/mode → repaint immediately.
  await onSettingsChange(async () => {
    settings = await getSettings();
    render();
  });
  // Move the "now" line / roll to the next day or week without a reload.
  setInterval(render, config.clockTickMs);
}

main();
