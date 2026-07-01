# glance-cal — ideas & future improvements

A running list of things to build or harden later. Nothing here is required for
day-to-day use — the app works as-is. Roughly ordered by how likely they are to
matter.

---

## Security: from "obscurity" to actual protection

**Current model (deliberate, fine for now):** the app is a static site whose
`config.js` ships the Supabase **anon key** to every visitor's browser, and the
`items` table has an open row-level-security policy (anyone with the key can
read/write). Protection today = the deployment lives at an *unguessable* URL
(`glance-cal-…vercel.app`) that isn't shared anywhere. For a private, solo
calendar this is a reasonable trade. It is **not** real security — anyone who
learns the URL can read or edit the calendar.

When/if that's not good enough, here are the options, lightest to heaviest:

### Option A — Vercel password protection (Deployment Protection)
- **What:** gate the site behind a password at the Vercel edge, before any
  page loads. Project → Settings → Deployment Protection → Password Protection.
- **Pros:** ~zero code; protects the key too (page never loads without the pw).
- **Cons:** the **display** page would also demand a password, which is annoying
  for a wallpaper that's supposed to be glance-and-go. Best if applied only to
  the entry page, or if you accept entering the password once per device/session.
- **Note:** password protection is a paid Vercel feature on some plans — check
  current plan limits before relying on it.

### Option B — Supabase Auth + tightened RLS (the "real" fix)
- **What:** require login; replace the open policy with per-user rules
  (`auth.uid() = user_id`). The anon key stops being a master key — it can't do
  anything useful without a logged-in session.
- **Pros:** genuinely secure; correct if the calendar ever holds sensitive info
  or is shared with anyone.
- **Cons:** most work. Adds a login screen, which is awkward on a wallpaper —
  the display would need a long-lived session or a separate read path. Would
  likely want a read-only "display token" concept so the wallpaper doesn't need
  full auth.

### Option C — Split read vs. write
- **What:** keep the display effectively read-only/public-ish, but require auth
  (or a secret) only for writes from the entry app. Could use a Supabase Edge
  Function or a separate, more-restrictive policy for inserts/updates.
- **Pros:** preserves the frictionless wallpaper while protecting *changes*.
- **Cons:** middle complexity; need to design the write path carefully.

### Housekeeping note (from initial setup)
When the project was first deployed to the guessable `glance-cal.vercel.app` and
then renamed, the old domain kept serving `config.js` (with the anon key) from
stale CDN cache for a while after the project was deleted. If real security is
ever added, **rotate the Supabase keys** at that point, since the anon key was
briefly served from a guessable URL. (Low risk — short window, URL never shared —
but worth doing as part of any real hardening pass.)

---

## Display views (data already supports these)

The renderer is split (a `render()` dispatcher over per-view functions sharing
the same item data) specifically so new views are just new render functions:

- ✅ **Day view** — single-day, two columns (timed events | to-dos, incl. open
  overdue ones). Shipped.
- ✅ **View switcher** — synced view/mode controlled from the phone, plus
  per-device `?view=`/`?show=`/`?chrome=` URL overrides (e.g. day on the iPad,
  week on the desktop). Shipped.
- **Month** view — big-picture overview grid. Still to do; slots into the same
  `VIEWS` map in `display.js`.
- **Agenda** view — a flat chronological list, good for narrow screens.
- could the calendar have a 'tomorrow' or 'upcoming' section at the bottom if there are any events scheduled tomorrow

## Glanceability / prioritization

- todos should show all open to-dos, not just ones due that day
- **Spotlight high-priority items** — a toggle or always-on highlight that makes
  `▴▴▴` items pop (glow, larger, pinned to top of their day).
- **Sort / filter** — by priority, category, or status; hide done items.
- **Per-status or per-priority view modes** — e.g. a "what's urgent" lens.
- **Custom icons per category** — beyond color, give each category a glyph for
  even faster recognition.
- **Custom categories** - sort of like tags? user can add and delete categories + associate a category with a color (+ optional icon per above)
- hide completed items by default
- separate notes section in bottom right? (like built-in Stickies)

## Data & sync

- **Recurring events** — daily/weekly/monthly repeats (currently every item is
  one-off).
- **Google Calendar import** — one-way pull so existing events show up.
- **Multiple calendars / contexts** — toggle work vs. personal, etc.
- to-do items don't need a start date/time by default, just optional due date
- todos with no due date are listed below dated items

## Polish

- **Light theme / theme options** — current design is dark-only.
- **Configurable week vs. work-week** (5-day) display.
- **PWA icons** — proper app icons for the iPhone home-screen install.
- **Offline resilience** — cache last-known data so the display survives a
  network blip.


# UI updates
- larger font size; larger + bolder priority symbols ✅
- title text left aligned, due date + priority symbol right aligned ✅
- lighter (more pastel-ish?) / slightly translucent(?) colors ✅
- more padding around item text and between items ✅
- bright red border is kind of hard to look at, especially against bright background colors; make darker? make sure text is readable against the background ✅

- would also be great to be able to select colors, maybe categories?, via the entry page

7/1
- when adding a todo, there should be no start/end date entry available, just due date (which is optional) ✅ (due date now optional; undated todos supported — required dropping NOT NULL on `items.start`, see schema.sql migration)
- when adding an event, there should be no due date entry available, just start/end ✅ (already the case — the entry form swaps date fields by type)
- i don’t really use the 'in progress' status, just complete or not — let's remove the progress ui, instead show all and only uncompleted todos ✅ (status is now a "Done" checkbox; completed todos are hidden on the display)
- instead of priority triangles, let's try just ordering by priority (maybe make the color slightly darker for each increase in priority?) ✅ (▴ icons removed; to-dos sort by priority and each priority step deepens the fill color)
- currently you can only see and edit items due this week (on entry page); should be able to at least check off / delete any item ✅ (entry list now shows all items with an inline check-off; edit/delete via the row)

- colors still a bit too bright, maybe let background seep through a bit? less bright base colors? ✅ (fill alpha lowered to 0.78 so the dark desktop shows through — tune in softFill())
- remove checkbox (since you can’t check it, and once checked, the row will just disappear anyway) ✅
- make calendar and todos match stylistically -- same text sizes etc ✅
  - calendar: more padding, bigger text ✅
  - todos: less bold ✅

