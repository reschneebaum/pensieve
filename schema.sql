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
