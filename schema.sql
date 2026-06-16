-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- It creates the single table glance-cal uses, plus a permissive policy.
--
-- NOTE: this policy allows anyone with your anon key to read/write the table.
-- That's fine for a private, single-user calendar where you don't advertise
-- the URL. If you ever want it locked down, add Supabase Auth and replace the
-- policy with `auth.uid() = user_id` style rules.

create table if not exists public.items (
  id          text primary key,
  title       text not null,
  type        text not null default 'event',   -- 'event' | 'todo'
  category    text not null default 'none',
  start       timestamptz not null,
  "end"       timestamptz,
  all_day     boolean not null default false,
  priority    smallint not null default 0,     -- 0..3
  status      text not null default 'todo',     -- 'todo' | 'doing' | 'done'
  notes       text default '',
  updated_at  timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "anon full access" on public.items
  for all using (true) with check (true);

-- Realtime: make sure the table is in the realtime publication so the
-- desktop display updates the instant your phone writes a change.
alter publication supabase_realtime add table public.items;


-- ─────────────────────────────────────────────────────────────────────────
-- Display settings (added for the view switcher).
--
-- A tiny key→jsonb table. glance-cal uses a single row, id = 'display', whose
-- value holds { "view": "week"|"day", "show": "calendar"|"todo"|"both" }. The
-- phone (entry app) writes it; the desktop display subscribes and repaints. If
-- the row is absent, the display falls back to its defaults (week / both), so
-- existing installs keep working without touching this table.
--
-- Safe to run on an existing database — everything here is idempotent.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.settings (
  id          text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'settings'
      and policyname = 'anon full access'
  ) then
    create policy "anon full access" on public.settings
      for all using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;
