// Mobile entry app. Add / edit / delete items; tap an item in the list to
// edit it. Writes go through store.js, so in cloud mode the desktop display
// updates the moment you hit save.

import { CATEGORIES } from "./config.js";
import { getItems, upsertItem, deleteItem, onChange, MODE } from "./store.js";
import { uid, toLocalInput, toDateInput, startOfWeek, addDays, sameDay, categoryById, priorityIcon, fmtTime } from "./util.js";

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
  $("#due").value = toDateInput(new Date());
  $("#delete").hidden = true;
  $("#save").textContent = "Add to calendar";
}

function loadIntoForm(item) {
  $("#id").value = item.id;
  $("#title").value = item.title;
  setType(item.type);
  selectCategory(item.category);
  $("#priority").value = String(item.priority ?? 0);
  $("#status").value = item.status || "todo";
  $("#notes").value = item.notes || "";
  if (item.type === "event") {
    $("#start").value = toLocalInput(new Date(item.start));
    $("#end").value = item.end ? toLocalInput(new Date(item.end)) : "";
  } else {
    $("#due").value = toDateInput(new Date(item.start));
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
    // To-do: anchor to noon of the due date so it lands on the right day.
    const due = new Date($("#due").value + "T12:00");
    start = due.toISOString();
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
    status: $("#status").value,
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

  const weekStart = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const inWeek = items
    .filter((it) => weekDays.some((d) => sameDay(new Date(it.start), d)))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  if (!inWeek.length) {
    ul.innerHTML = '<li class="empty">Nothing this week yet.</li>';
    return;
  }

  ul.innerHTML = "";
  for (const it of inWeek) {
    const cat = categoryById(it.category);
    const d = new Date(it.start);
    const when =
      it.type === "event"
        ? `${d.toLocaleDateString([], { weekday: "short" })} ${fmtTime(d)}`
        : `Due ${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`;

    const li = document.createElement("li");
    li.className = "li";
    li.style.setProperty("--c", cat.color);
    li.innerHTML =
      `<div class="li-main">` +
      `<div class="li-title ${it.status === "done" ? "done" : ""}">${escapeHtml(it.title)}</div>` +
      `<div class="li-sub">${cat.name} · ${when}</div></div>` +
      `<span class="li-prio">${priorityIcon(it.priority)}</span>` +
      `<button type="button" aria-label="edit">✎</button>`;
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
  resetForm();
  renderList();
  onChange(renderList);
}

main();
