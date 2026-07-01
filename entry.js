// Mobile entry app. Add / edit / delete items; tap an item in the list to
// edit it. Writes go through store.js, so in cloud mode the desktop display
// updates the moment you hit save.

import { CATEGORIES } from "./config.js";
import {
  getItems, upsertItem, deleteItem, onChange, MODE,
  getSettings, setSettings, onSettingsChange,
} from "./store.js";
import { uid, toLocalInput, toDateInput, categoryById, fmtTime } from "./util.js";

const $ = (s) => document.querySelector(s);
let currentType = "event";
let currentCategory = CATEGORIES[0].id;

function buildCats() {
  $("#cats").innerHTML = CATEGORIES.map(
    (c) =>
      `<button type="button" class="cat" data-cat="${c.id}">` +
      `<span class="dot" style="background:${c.color}"></span>${c.name}</button>`
  ).join("");
  $("#cats").querySelectorAll(".cat").forEach((btn) => {
    btn.addEventListener("click", () => selectCategory(btn.dataset.cat));
  });
  selectCategory(currentCategory);
}

function selectCategory(id) {
  currentCategory = id;
  $("#cats").querySelectorAll(".cat").forEach((b) =>
    b.classList.toggle("active", b.dataset.cat === id)
  );
}

function setType(type) {
  currentType = type;
  $("#type").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.type === type)
  );
  $("#when-event").hidden = type !== "event";
  $("#when-todo").hidden = type !== "todo";
  $("#done-field").hidden = type !== "todo";
  $("#start").required = type === "event";
}

function resetForm() {
  $("#form").reset();
  $("#id").value = "";
  setType("event");
  selectCategory(CATEGORIES[0].id);
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  $("#start").value = toLocalInput(now);
  const end = new Date(now);
  end.setHours(end.getHours() + 1);
  $("#end").value = toLocalInput(end);
  $("#due").value = ""; // due date is optional; leave empty by default
  $("#done").checked = false;
  $("#delete").hidden = true;
  $("#save").textContent = "Add to calendar";
}

function loadIntoForm(item) {
  $("#id").value = item.id;
  $("#title").value = item.title;
  setType(item.type);
  selectCategory(item.category);
  $("#priority").value = String(item.priority ?? 0);
  $("#done").checked = item.status === "done";
  $("#notes").value = item.notes || "";
  if (item.type === "event") {
    $("#start").value = toLocalInput(new Date(item.start));
    $("#end").value = item.end ? toLocalInput(new Date(item.end)) : "";
  } else {
    $("#due").value = item.start ? toDateInput(new Date(item.start)) : "";
  }
  $("#delete").hidden = false;
  $("#save").textContent = "Save changes";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onSubmit(e) {
  e.preventDefault();
  const id = $("#id").value || uid();
  let start, end, all_day;

  if (currentType === "event") {
    start = new Date($("#start").value).toISOString();
    end = $("#end").value ? new Date($("#end").value).toISOString() : null;
    all_day = false;
  } else {
    // To-do: due date is optional. When set, anchor to noon of that date so it
    // lands on the right day; when blank, leave undated (start = null).
    start = $("#due").value ? new Date($("#due").value + "T12:00").toISOString() : null;
    end = null;
    all_day = true;
  }

  const item = {
    id,
    title: $("#title").value.trim(),
    type: currentType,
    category: currentCategory,
    start,
    end,
    all_day,
    priority: Number($("#priority").value),
    status: $("#done").checked ? "done" : "todo",
    notes: $("#notes").value.trim(),
  };

  await upsertItem(item);
  resetForm();
  await renderList();
}

async function renderList() {
  const ul = $("#items");
  let items = [];
  try { items = await getItems(); } catch (e) { console.error(e); }

  // Show every item (not just this week) so anything can be checked off or
  // deleted. Open items first, done sink to the bottom; within each, ordered by
  // date with undated todos last.
  const dateKey = (it) => (it.start ? +new Date(it.start) : Infinity);
  const sorted = items.slice().sort(
    (a, b) =>
      (a.status === "done") - (b.status === "done") ||
      dateKey(a) - dateKey(b)
  );

  if (!sorted.length) {
    ul.innerHTML = '<li class="empty">Nothing yet — add something above.</li>';
    return;
  }

  ul.innerHTML = "";
  for (const it of sorted) {
    const cat = categoryById(it.category);
    const d = it.start ? new Date(it.start) : null;
    const when =
      it.type === "event"
        ? (d ? `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${fmtTime(d)}` : "")
        : (d ? `Due ${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}` : "No due date");

    const li = document.createElement("li");
    li.className = "li";
    li.style.setProperty("--c", cat.color);
    li.innerHTML =
      `<input type="checkbox" class="li-check" aria-label="mark done" ${it.status === "done" ? "checked" : ""} />` +
      `<div class="li-main">` +
      `<div class="li-title ${it.status === "done" ? "done" : ""}">${escapeHtml(it.title)}</div>` +
      `<div class="li-sub">${escapeHtml(cat.name)}${when ? " · " + when : ""}</div></div>` +
      `<button type="button" aria-label="edit">✎</button>`;

    // Inline check-off: toggle done without opening the editor.
    li.querySelector(".li-check").addEventListener("click", async (e) => {
      e.stopPropagation();
      const status = e.target.checked ? "done" : "todo";
      try { await upsertItem({ ...it, status }); } catch (err) { console.error(err); }
      await renderList();
    });
    li.querySelector("button").addEventListener("click", () => loadIntoForm(it));
    li.querySelector(".li-main").addEventListener("click", () => loadIntoForm(it));
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ── Desktop display controls ───────────────────────────────────────────────
// These write the synced settings the display reads, so flipping a toggle here
// repaints every (un-pinned) display device. Note: a screen pinned via a URL
// param (?view=…) ignores these — that override is intentional.
function activate(seg, attr, val) {
  seg.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset[attr] === val)
  );
}

function reflectSettings(s) {
  activate($("#view-seg"), "view", s.view);
  activate($("#show-seg"), "show", s.show);
}

function wireDisplayControls() {
  const bind = (segSel, attr) =>
    $(segSel).querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", async () => {
        activate($(segSel), attr, b.dataset[attr]); // optimistic
        try {
          await setSettings({ [attr]: b.dataset[attr] });
        } catch (e) {
          console.error("settings save failed", e);
        }
      })
    );
  bind("#view-seg", "view");
  bind("#show-seg", "show");
}

function main() {
  $("#mode").textContent = MODE === "cloud" ? "synced" : "local only";
  buildCats();
  $("#type").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => setType(b.dataset.type))
  );
  $("#form").addEventListener("submit", onSubmit);
  $("#delete").addEventListener("click", async () => {
    const id = $("#id").value;
    if (id) { await deleteItem(id); resetForm(); await renderList(); }
  });
  wireDisplayControls();
  getSettings().then(reflectSettings).catch((e) => console.error(e));
  onSettingsChange(async () => reflectSettings(await getSettings()));

  resetForm();
  renderList();
  onChange(renderList);
}

main();
