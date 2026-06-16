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

The renderer is split (`computeWeek` → `render`) specifically so new views are
just new render functions over the same item data:

- **Month** view — big-picture overview grid.
- **Day / agenda** view — single-day vertical timeline with full detail.
- **View switcher** — cycle views, or pick per device (e.g. month on the wall
  tablet, week on the desktop).

## Glanceability / prioritization

- **Spotlight high-priority items** — a toggle or always-on highlight that makes
  `▴▴▴` items pop (glow, larger, pinned to top of their day).
- **Sort / filter** — by priority, category, or status; hide done items.
- **Per-status or per-priority view modes** — e.g. a "what's urgent" lens.
- **Custom icons per category** — beyond color, give each category a glyph for
  even faster recognition.

## Data & sync

- **Recurring events** — daily/weekly/monthly repeats (currently every item is
  one-off).
- **Google Calendar import** — one-way pull so existing events show up.
- **Multiple calendars / contexts** — toggle work vs. personal, etc.

## Polish

- **Light theme / theme options** — current design is dark-only.
- **Configurable week vs. work-week** (5-day) display.
- **PWA icons** — proper app icons for the iPhone home-screen install.
- **Offline resilience** — cache last-known data so the display survives a
  network blip.
