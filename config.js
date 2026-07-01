// ─────────────────────────────────────────────────────────────────────────
// glance-cal config
//
// Out of the box this runs in LOCAL mode: data is stored in your browser's
// localStorage. That's perfect for trying it on a single device (e.g. just
// your Mac), but it will NOT sync between your iPhone and your Mac.
//
// To get real cross-device sync (edit on iPhone → Mac wallpaper updates),
// create a free Supabase project, run schema.sql in its SQL editor, then
// paste your project URL + anon key below. See README.md for the walkthrough.
// ─────────────────────────────────────────────────────────────────────────

export const config = {
  // Leave both empty to stay in LOCAL mode. Fill both in for CLOUD sync.
  supabaseUrl: "https://nneaxdbdmdxnesjorjil.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZWF4ZGJkbWR4bmVzam9yamlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTgzNDksImV4cCI6MjA5NzA5NDM0OX0.UPlOQqtmJgWgO5S644_fOQX_KgcV1gri4DG0DWSnueM",

  // Week starts on Monday (1) or Sunday (0).
  weekStartsOn: 1,

  // Hours shown on the time grid (24h). Items outside this range still appear
  // in the all-day / overflow row.
  dayStartHour: 7,
  dayEndHour: 23,

  // How often the display re-checks the clock (moves the "now" line). ms.
  clockTickMs: 60_000,
};

// Categories drive the colors. Edit freely — `id` must stay stable once used.
export const CATEGORIES = [
  { id: "work",     name: "Work",     color: "#4f8cff" },
  { id: "health",   name: "Health",   color: "#36c98d" },
  { id: "personal", name: "Personal", color: "#ff9f43" },
  { id: "social",   name: "Social",   color: "#c074f0" },
  { id: "errands",  name: "Errands",  color: "#ff6b81" },
  { id: "none",     name: "Other",    color: "#7a869a" },
];

// Priority: index 0..3. Icon shows for 1+ (low/med/high).
export const PRIORITIES = [
  { value: 0, label: "None", icon: "" },
  { value: 1, label: "Low",  icon: "▴" },
  { value: 2, label: "Med",  icon: "▴▴" },
  { value: 3, label: "High", icon: "▴▴▴" },
];

// Status is binary: either done or not. (An earlier "doing"/in-progress state
// was dropped — see IDEAS.md. Legacy "doing" rows are treated as not-done.)
export const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "done", label: "Done" },
];
