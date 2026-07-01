# pensieve

A colorful day-at-a-glance organization tool you paint onto your Mac desktop, fed by a quick add/edit app on your iPhone. 

Edit on the phone → the desktop updates on its own. No alerts, no alarms — just always there when you look.

```
 iPhone (entry.html)  ──writes──▶  data store  ──realtime──▶  Mac desktop (display.html via Plash)
```

- **Color** = category (Work / Health / Personal / …) — edit them in `config.js`.
- **Priority** = the higher the priority, the darker the background color of each item.
- **Status** = done items are hidden by default (but can be seen + edited via the entry page).
- **Views** = default view is a two-column **day** view (events | to-dos).
  You can switch to weekly calendar mode from your phone, or pin a screen via URL — see [Display views & modes](#display-views--modes).

Everything is plain HTML/CSS/JS — **no build step, no npm.**

---

## 1. Try it in 60 seconds (local-only, one device)

Out of the box it runs in **local mode** (data in your browser's localStorage).
ES modules need a real web server (not `file://`), so from this folder run:

```bash
cd pensieve
python3 -m http.server 8000
```

Then open:
- Display: <http://localhost:8000/display.html>
- Add items: <http://localhost:8000/entry.html>

Add a few items in `entry.html`, watch them appear in `display.html`. In local
mode the two pages sync only within the **same browser** — that's expected.
Cross-device sync needs step 2.

---

## 2. Turn on cross-device sync (Supabase — free)

1. Create a project at <https://supabase.com> (free tier is plenty).
2. In the dashboard: **SQL → New query**, paste the contents of
   [`schema.sql`](schema.sql), and run it.
3. **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. Paste both into [`config.js`](config.js):

   ```js
   supabaseUrl: "https://xxxx.supabase.co",
   supabaseAnonKey: "eyJ...",
   ```

The header on each page will switch from `local only` to `synced`. Now any
device pointed at the same deployment shares one calendar, and the display
updates live when the phone writes a change.

> Security note: the anon key + open policy means anyone who knows your URL can
> read/write the calendar. Fine for a private URL you don't share. Lock it down
> later with Supabase Auth if you want (see the comment in `schema.sql`).

---

## 3. Put it on a URL (so it works without a terminal running)

For the desktop wallpaper and your phone to reach it anytime, deploy the folder
as a static site. Easiest:

- **Vercel:** `npm i -g vercel` then `vercel` in this folder (accept defaults), or
- **Netlify:** drag the folder onto <https://app.netlify.com/drop>, or
- **Cloudflare Pages / GitHub Pages** — any static host works.

You'll get a URL like `https://glance-cal.vercel.app`. Your two pages are then:
- `…/display.html`
- `…/entry.html`

(Because Supabase creds live in `config.js` which ships to the browser, keep the
deployment private/unshared — same note as above.)

---

## 4. Make it your Mac desktop (Plash)

1. Install **Plash** — free, from the Mac App Store (or <https://sindresorhus.com/plash>).
2. Plash menu bar icon → **Add Website** → paste your `…/display.html` URL. For a
   clean wallpaper, add params — e.g. `…/display.html?view=day&chrome=off` for a
   distraction-free single-day view. See [Display views & modes](#display-views--modes).
3. Recommended Plash settings:
   - **Reload interval:** off (the page updates itself via realtime + its own clock).
   - **Browsing mode:** off (it's display-only).
   - **Deactivate on battery / when app is fullscreen:** your call.

The calendar now lives on your desktop, behind your windows, always glanceable.

---

## Display views & modes

The display reads two things: a **synced setting** you control from the phone, and
optional **URL params** that pin a single screen.

**From the phone** (`entry.html` → *Desktop display* panel): pick the **View**
(Week / Day) and what to **Show** (Calendar / To-do / Both). Tapping a toggle
updates every display device in realtime. This is the easy, no-URL way.

**Per-screen URL params** override the synced setting for *that* screen only —
handy for a set-and-forget wallpaper, or running the iPad on day view while the
Mac stays on week:

| Param | Values | Effect |
|---|---|---|
| `view` | `week` (default) · `day` | Week grid, or the two-column day view (events \| to-dos). |
| `show` | `both` (default) · `calendar` · `todo` | Which item types appear. |
| `chrome` | (omit) · `off` | `chrome=off` = low-distraction: hides the header, color key and to-do notes, leaving just the calendar. Great for a desktop wallpaper. |

Combine them: `…/display.html?view=day&chrome=off&show=calendar`. A screen with no
params just follows whatever the phone last set.

The **day view** shows today: timed events on a timeline (left) and your to-dos
(right), including any open **overdue** to-dos carried forward. It's built for wide
screens (desktop / iPad); on a phone the two columns stack.

---

## Customizing

- **Categories & colors:** `CATEGORIES` in `config.js`.
- **Visible hours / week start:** `dayStartHour`, `dayEndHour`, `weekStartsOn` in `config.js`.
- **Look:** `display.css` (wallpaper) and `entry.css` (phone). Dark theme by default.

## Files

| File | Role |
|---|---|
| `config.js` | Settings, Supabase creds, categories/priorities/statuses |
| `store.js` | Data layer — Supabase or localStorage, same API, realtime |
| `util.js` | Shared date/color helpers |
| `display.html/.css/.js` | The desktop week view (read-only) |
| `entry.html/.css/.js` | The iPhone add/edit app (PWA) |
| `schema.sql` | One-time Supabase tables + realtime setup (`items` + display `settings`) |

## Ideas parked for later

See [`IDEAS.md`](IDEAS.md) — future views (month/day/agenda), prioritization
features, recurring events, and the path from the current obscurity-based
security model to real protection (Vercel password / Supabase Auth).

---

## Why?

> One simply siphons the excess thoughts from one's mind, pours them into the basin, and examines them at one's leisure.

  —Albus Dumbledore
