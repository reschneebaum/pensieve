// Data layer. Transparently uses Supabase (cloud sync) when configured,
// otherwise falls back to localStorage (single-device). Both expose the
// same async API so display.js / entry.js don't care which is active.
//
// Item shape:
//   { id, title, type:'event'|'todo', category, start, end, all_day,
//     priority:0..3, status:'todo'|'doing'|'done', notes, updated_at }
// `start`/`end` are ISO strings. For all-day items / todos, `end` may be null.

import { config } from "./config.js";

const LOCAL_KEY = "glancecal.items.v1";
const SETTINGS_LOCAL_KEY = "glancecal.settings.v1";
export const MODE = config.supabaseUrl && config.supabaseAnonKey ? "cloud" : "local";

// The single settings row the display reads. Defaults reproduce the original
// behavior (week view, everything shown) so installs without a settings row —
// or without the table — keep working unchanged.
const SETTINGS_ID = "display";
export const DEFAULT_SETTINGS = { view: "week", show: "both" };

let supabase = null;
const listeners = new Set();
const settingsListeners = new Set();

async function getClient() {
  if (supabase) return supabase;
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabase;
}

// ── Local mode ───────────────────────────────────────────────────────────
function localRead() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}
function localWrite(items) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  // Notify this tab; other tabs get the native `storage` event below.
  listeners.forEach((cb) => cb());
}

function localReadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_LOCAL_KEY)) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
function localWriteSettings(value) {
  localStorage.setItem(SETTINGS_LOCAL_KEY, JSON.stringify(value));
  settingsListeners.forEach((cb) => cb());
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function getItems() {
  if (MODE === "local") return localRead();
  const sb = await getClient();
  const { data, error } = await sb.from("items").select("*");
  if (error) throw error;
  return data;
}

export async function upsertItem(item) {
  const record = { ...item, updated_at: new Date().toISOString() };
  if (MODE === "local") {
    const items = localRead();
    const i = items.findIndex((x) => x.id === record.id);
    if (i >= 0) items[i] = record;
    else items.push(record);
    localWrite(items);
    return record;
  }
  const sb = await getClient();
  const { error } = await sb.from("items").upsert(record);
  if (error) throw error;
  return record;
}

export async function deleteItem(id) {
  if (MODE === "local") {
    localWrite(localRead().filter((x) => x.id !== id));
    return;
  }
  const sb = await getClient();
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) throw error;
}

// ── Display settings ─────────────────────────────────────────────────────
// view/mode for the display, controlled from the phone and synced to every
// display device. Same dual-mode contract as items: cloud uses a `settings`
// row, local uses localStorage. Always merged over DEFAULT_SETTINGS so a
// missing row (or a missing table on an un-migrated database) is harmless.
export async function getSettings() {
  if (MODE === "local") return localReadSettings();
  try {
    const sb = await getClient();
    const { data, error } = await sb
      .from("settings")
      .select("value")
      .eq("id", SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, ...(data?.value ?? {}) };
  } catch (e) {
    // Table not migrated yet, or a transient error — fall back to defaults
    // rather than breaking the display.
    console.warn("settings load failed, using defaults", e);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function setSettings(partial) {
  const current = await getSettings();
  const value = { ...current, ...partial };
  if (MODE === "local") {
    localWriteSettings(value);
    return value;
  }
  const sb = await getClient();
  const { error } = await sb
    .from("settings")
    .upsert({ id: SETTINGS_ID, value, updated_at: new Date().toISOString() });
  if (error) throw error;
  return value;
}

// Subscribe to settings changes. Returns an unsubscribe function.
export async function onSettingsChange(cb) {
  settingsListeners.add(cb);

  if (MODE === "local") {
    const handler = (e) => {
      if (e.key === SETTINGS_LOCAL_KEY) cb();
    };
    window.addEventListener("storage", handler);
    return () => {
      settingsListeners.delete(cb);
      window.removeEventListener("storage", handler);
    };
  }

  const sb = await getClient();
  const channel = sb
    .channel("settings-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () =>
      cb()
    )
    .subscribe();
  return () => {
    settingsListeners.delete(cb);
    sb.removeChannel(channel);
  };
}

// Subscribe to changes (any device in cloud mode, any tab in local mode).
// Returns an unsubscribe function.
export async function onChange(cb) {
  listeners.add(cb);

  if (MODE === "local") {
    const handler = (e) => {
      if (e.key === LOCAL_KEY) cb();
    };
    window.addEventListener("storage", handler);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", handler);
    };
  }

  const sb = await getClient();
  const channel = sb
    .channel("items-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () =>
      cb()
    )
    .subscribe();
  return () => {
    listeners.delete(cb);
    sb.removeChannel(channel);
  };
}
