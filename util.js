// Shared helpers used by both the display and the entry app.
import { CATEGORIES, PRIORITIES, config } from "./config.js";

export const uid = () =>
  "i_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const categoryById = (id) =>
  CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const priorityIcon = (p) =>
  (PRIORITIES.find((x) => x.value === Number(p)) || PRIORITIES[0]).icon;

// ── Date helpers (local time, no external libs) ──────────────────────────
export const pad = (n) => String(n).padStart(2, "0");

export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Start of the week containing `date`, respecting config.weekStartsOn.
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - config.weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// "2026-06-12T14:30" (value used by <input type="datetime-local">)
export function toLocalInput(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// "2026-06-12" (value used by <input type="date">)
export function toDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const fmtTime = (date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtDayName = (date) =>
  date.toLocaleDateString([], { weekday: "short" });

// Minutes from midnight, used to position items on the time grid.
export const minutesOfDay = (date) => date.getHours() * 60 + date.getMinutes();
