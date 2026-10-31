-- GymNotes — Supabase schema
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- for the project referenced by VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
--
-- Every table is scoped to the signed-in user with Row Level Security, so a
-- project can safely host multiple accounts. Users can only read and write
-- their own rows.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text        not null default '',
  sex        text        not null default 'male' check (sex in ('male', 'female', 'other')),
  age        integer,
  height_cm  numeric,
  weight_kg  numeric,
  unit       text        not null default 'kg' check (unit in ('kg', 'lb')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Custom exercises
-- ---------------------------------------------------------------------------
create table if not exists public.custom_exercises (
  id           text primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  name         text        not null,
  muscle_group text        not null
                           check (muscle_group in ('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core')),
  created_at   timestamptz not null default now()
);

create index if not exists custom_exercises_user_id_idx on public.custom_exercises (user_id);

-- ---------------------------------------------------------------------------
-- Workouts
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id            text primary key,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  date          date        not null,
  exercise_id   text        not null,
  sets          jsonb       not null default '[]'::jsonb,
  bodyweight_kg numeric,
  notes         text,
  created_at    bigint      not null default 0,
  updated_at    timestamptz not null default now()
);

create index if not exists workouts_user_id_idx on public.workouts (user_id);
create index if not exists workouts_user_exercise_idx on public.workouts (user_id, exercise_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.workouts         enable row level security;

drop policy if exists "profiles are owned by the user" on public.profiles;
create policy "profiles are owned by the user"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "custom exercises are owned by the user" on public.custom_exercises;
create policy "custom exercises are owned by the user"
  on public.custom_exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workouts are owned by the user" on public.workouts;
create policy "workouts are owned by the user"
  on public.workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on writes.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists workouts_touch_updated_at on public.workouts;
create trigger workouts_touch_updated_at
  before update on public.workouts
  for each row execute function public.touch_updated_at();
