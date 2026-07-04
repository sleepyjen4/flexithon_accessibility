-- Section 4: data model — keep to these 4 tables.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  abilities jsonb not null default '{}'::jsonb,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id text primary key,
  name text not null,
  description text not null,
  positions text[] not null default '{}',
  equipment text[] not null default '{}',
  body_regions text[] not null default '{}',
  intensity int not null check (intensity between 1 and 5),
  instructions jsonb not null default '[]'::jsonb,
  audio_url text,
  image_url text
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  energy int not null check (energy between 1 and 5),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout jsonb not null,
  completed_steps int[] not null default '{}',
  effort int,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table checkins enable row level security;
alter table sessions enable row level security;
-- exercises: seeded, read-only at runtime — public read, no RLS needed beyond default deny for writes.
alter table exercises enable row level security;

create policy "profiles are self-readable" on profiles
  for select using (auth.uid() = id);
create policy "profiles are self-writable" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles are self-updatable" on profiles
  for update using (auth.uid() = id);

create policy "checkins are self-readable" on checkins
  for select using (auth.uid() = user_id);
create policy "checkins are self-writable" on checkins
  for insert with check (auth.uid() = user_id);

create policy "sessions are self-readable" on sessions
  for select using (auth.uid() = user_id);
create policy "sessions are self-writable" on sessions
  for insert with check (auth.uid() = user_id);
create policy "sessions are self-updatable" on sessions
  for update using (auth.uid() = user_id);

create policy "exercises are readable by anyone authenticated" on exercises
  for select using (auth.role() = 'authenticated');
