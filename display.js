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

// Soft pastel fill: blend the category color toward white and make it slightly
// translucent, so blocks read as gentle tints behind dark text rather than
// saturated slabs. The solid color is kept for the left-border accent.
function softFill(hex, t = 0.5, a = 0.9) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * t);
  return `rgba(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)}, ${a})`;
}

function setCatVars(el, item) {
  const cat = categoryById(item.category);
  el.style.setProperty("--c", softFill(cat.color));
  el.style.setProperty("--c-strong", cat.color);
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
  const el = document.createElement("div");
  el.className = `event ${statusClass(item)}`;
  setCatVars(el, item);
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
  const el = document.createElement("div");
  el.className = `chip ${statusClass(item)}`;
  setCatVars(el, item);
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

// ── Shared timeline pieces (used by both week and day views) ─────────────
// The left-hand gutter of hour labels.
function hourGutter() {
  const hours = document.createElement("div");
  hours.className = "hours";
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    const pct = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100;
    const lab = document.createElement("div");
    lab.className = "hour-label";
    lab.style.top = pct + "%";
    lab.textContent = (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? "a" : "p");
    hours.appendChild(lab);
  }
  return hours;
}

// Build one day's timeline column: hour lines, the "now" line if it's today,
// and the day's timed events. Returns { col, overflow } where overflow is the
// items belonging to this day that don't sit on the grid (todos, all-day, and
// off-grid events) — the caller decides where to put them.
function dayColumn(day, items, today, { showHead = true } = {}) {
  const col = document.createElement("div");
  col.className = "day-col" + (sameDay(day, today) ? " today" : "");

  if (showHead) {
    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML =
      `${day.toLocaleDateString([], { weekday: "short" })} ` +
      `<span class="dnum">${day.getDate()}</span>`;
    col.appendChild(head);
  }

  for (let h = HOUR_START + 1; h < HOUR_END; h++) {
    const line = document.createElement("div");
    line.className = "hour-line";
    line.style.top = ((h - HOUR_START) / (HOUR_END - HOUR_START)) * 100 + "%";
    col.appendChild(line);
  }

  if (sameDay(day, today)) {
    const mins = minutesOfDay(today) - HOUR_START * 60;
    if (mins >= 0 && mins <= TOTAL_MIN) {
      const now = document.createElement("div");
      now.id = "now-line";
      now.style.top = (mins / TOTAL_MIN) * 100 + "%";
      col.appendChild(now);
    }
  }

  const overflow = [];
  const dayItems = items.filter((it) => sameDay(new Date(it.start), day));
  for (const it of dayItems) {
    const start = new Date(it.start);
    const end = it.end ? new Date(it.end) : null;
    const timed = it.type === "event" && !it.all_day;
    const pos = timed ? timedPosition(start, end) : null;
    if (pos) col.appendChild(eventEl(it, pos));
    else overflow.push(it); // todos, all-day, off-grid events
  }
  return { col, overflow };
}

// Highest priority first; done items sink to the bottom.
function sortTodos(arr) {
  return arr
    .slice()
    .sort(
      (a, b) =>
        (a.status === "done") - (b.status === "done") ||
        (b.priority || 0) - (a.priority || 0)
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

  root.innerHTML = "";

  const allday = document.createElement("div");
  allday.id = "allday-row";
  allday.className = "allday-row";
  allday.innerHTML = '<div class="allday-spacer"></div>';

  const grid = document.createElement("div");
  grid.id = "time-grid";
  grid.className = "time-grid";
  grid.appendChild(hourGutter());

  const days$ = document.createElement("div");
  days$.className = "days";

  weekDays.forEach((day) => {
    const { col, overflow } = dayColumn(day, items, today);
    days$.appendChild(col);

    const cell = document.createElement("div");
    cell.className = "allday-cell";
    overflow.forEach((it) => cell.appendChild(chipEl(it)));
    allday.appendChild(cell);
  });

  grid.appendChild(days$);
  root.append(allday, grid);

  const hasAny = items.some((it) =>
    weekDays.some((d) => sameDay(new Date(it.start), d))
  );
  if (!hasAny) {
    const empty = document.createElement("div");
    empty.id = "empty";
    empty.textContent = "Nothing scheduled this week — add something from your phone.";
    grid.appendChild(empty);
  }
}

// ── Day view ─────────────────────────────────────────────────────────────
// Two columns on a wide screen: today's timed events on the left, the to-do
// list on the right. The "show" mode collapses to a single column.
function renderDay(root, items) {
  const today = new Date();
  $("#range").textContent = today.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const showEvents = active.show !== "todo";
  const showTodos = active.show !== "calendar";

  root.innerHTML = "";
  const layout = document.createElement("div");
  layout.className =
    "day-view" + (showEvents && showTodos ? "" : " single-col");
  if (showEvents) layout.appendChild(dayEventsColumn(items, today));
  if (showTodos) layout.appendChild(todoPanel(items, today));
  root.appendChild(layout);
}

function dayEventsColumn(items, today) {
  const section = document.createElement("section");
  section.className = "day-events";

  const { col, overflow } = dayColumn(today, items, today, { showHead: false });

  // All-day / off-grid events sit in a strip above the timeline. (Todos for
  // today live in the to-do panel, not here.)
  const allday = overflow.filter((it) => it.type !== "todo");
  if (allday.length) {
    const strip = document.createElement("div");
    strip.className = "day-allday";
    allday.forEach((it) => strip.appendChild(chipEl(it)));
    section.appendChild(strip);
  }

  const grid = document.createElement("div");
  grid.className = "time-grid";
  grid.appendChild(hourGutter());
  const days$ = document.createElement("div");
  days$.className = "days days-1";
  days$.appendChild(col);
  grid.appendChild(days$);
  section.appendChild(grid);

  return section;
}

function todoPanel(items, today) {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const todos = items.filter((it) => it.type === "todo");
  const todays = sortTodos(todos.filter((it) => sameDay(new Date(it.start), today)));
  const overdue = sortTodos(
    todos.filter((it) => new Date(it.start) < startOfToday && it.status !== "done")
  );

  const panel = document.createElement("section");
  panel.className = "todo-panel";
  panel.innerHTML = '<div class="todo-head">To-do</div>';

  const list = document.createElement("div");
  list.className = "todo-list";

  todays.forEach((it) => list.appendChild(todoRow(it)));

  if (overdue.length) {
    const div = document.createElement("div");
    div.className = "todo-divider";
    div.textContent = "Overdue";
    list.appendChild(div);
    overdue.forEach((it) => list.appendChild(todoRow(it, { overdue: true })));
  }

  if (!todays.length && !overdue.length) {
    const empty = document.createElement("div");
    empty.className = "todo-empty";
    empty.textContent = "Nothing to do today.";
    list.appendChild(empty);
  }

  panel.appendChild(list);
  return panel;
}

function todoRow(item, { overdue = false } = {}) {
  const el = document.createElement("div");
  el.className = `chip todo-row ${statusClass(item)}` + (overdue ? " overdue" : "");
  setCatVars(el, item);

  // Title on the left; due date (overdue only) + priority grouped on the right.
  const main = document.createElement("div");
  main.className = "todo-main";

  const title = document.createElement("span");
  title.className = "chip-title";
  title.textContent = (item.status === "done" ? "☑ " : "☐ ") + item.title;
  main.appendChild(title);

  // Priority sits just left of the due date, which is pushed to the far right.
  const icon = priorityIcon(item.priority);
  if (icon) {
    const prio = document.createElement("span");
    prio.className = "prio";
    prio.textContent = icon;
    main.appendChild(prio);
  }

  if (overdue) {
    const badge = document.createElement("span");
    badge.className = "overdue-badge";
    badge.textContent = new Date(item.start).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    main.appendChild(badge);
  }
  el.appendChild(main);

  const notes = (item.notes || "").trim();
  if (notes) {
    const n = document.createElement("div");
    n.className = "todo-notes";
    n.textContent = notes;
    el.appendChild(n);
  }
  return el;
}

// ── Dispatcher ───────────────────────────────────────────────────────────
// Map of view name → renderer. Month / agenda views slot in here later.
const VIEWS = {
  week: renderWeek,
  day: renderDay,
};

const ALLOWED_VIEWS = ["week", "day"];
const ALLOWED_SHOW = ["calendar", "todo", "both"];

// Optional per-device override via URL: ?view=day&show=todo. Lets one screen
// pin itself regardless of the synced setting (e.g. iPad on day, Mac on week).
// Invalid/absent params are ignored, so the synced setting wins by default.
function urlOverrides() {
  const p = new URLSearchParams(location.search);
  const o = {};
  if (ALLOWED_VIEWS.includes(p.get("view"))) o.view = p.get("view");
  if (ALLOWED_SHOW.includes(p.get("show"))) o.show = p.get("show");
  return o;
}

let allItems = [];
let settings = { ...DEFAULT_SETTINGS };
let override = {};
let active = { ...DEFAULT_SETTINGS };

function render() {
  active = { ...settings, ...override };
  const renderer = VIEWS[active.view] || renderWeek;
  renderer($("#view-root"), byMode(allItems, active.show));
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
  override = urlOverrides();
  // Low-distraction mode for the desktop wallpaper: ?chrome=off hides the
  // header, color key and to-do notes, leaving the calendar itself. Per-device
  // (it rides the URL, not the synced setting) so the iPad/monitor stays full.
  if (new URLSearchParams(location.search).get("chrome") === "off") {
    document.body.classList.add("chrome-off");
  }
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
