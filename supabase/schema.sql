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

-- Sessions group several exercise rows logged together. These columns are
-- additive so existing installs keep working after re-running this file.
alter table public.workouts add column if not exists session_id     text;
alter table public.workouts add column if not exists session_name   text;
alter table public.workouts add column if not exists superset_group integer;
alter table public.workouts add column if not exists position       integer not null default 0;

create index if not exists workouts_user_id_idx on public.workouts (user_id);
create index if not exists workouts_user_exercise_idx on public.workouts (user_id, exercise_id);
create index if not exists workouts_user_session_idx on public.workouts (user_id, session_id);

-- ---------------------------------------------------------------------------
-- Routines (saved exercise templates for the session builder)
-- ---------------------------------------------------------------------------
create table if not exists public.routines (
  id         text primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  name       text        not null,
  entries    jsonb       not null default '[]'::jsonb,
  created_at bigint      not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_id_idx on public.routines (user_id);

-- ---------------------------------------------------------------------------
-- Private feedback inbox. Admin rows are assigned manually by the project owner.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   text not null check (category in ('bug', 'idea', 'other')),
  message    text not null check (char_length(message) between 10 and 2000),
  status     text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_user_id_idx on public.feedback (user_id);

-- ---------------------------------------------------------------------------
-- Habits & check-ins (goals page)
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id              text primary key,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  name            text        not null,
  target_per_week integer     not null default 7 check (target_per_week between 1 and 7),
  note            text        not null default '',
  created_at      bigint      not null default 0,
  updated_at      timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits (user_id);

create table if not exists public.habit_checks (
  id         text primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  habit_id   text        not null references public.habits (id) on delete cascade,
  date       date        not null,
  created_at bigint      not null default 0,
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists habit_checks_user_id_idx on public.habit_checks (user_id);
create index if not exists habit_checks_habit_id_idx on public.habit_checks (habit_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.custom_exercises enable row level security;
alter table public.workouts         enable row level security;
alter table public.habits           enable row level security;
alter table public.habit_checks     enable row level security;
alter table public.routines         enable row level security;
alter table public.admin_users      enable row level security;
alter table public.feedback         enable row level security;

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

drop policy if exists "habits are owned by the user" on public.habits;
create policy "habits are owned by the user"
  on public.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "habit checks are owned by the user" on public.habit_checks;
create policy "habit checks are owned by the user"
  on public.habit_checks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "routines are owned by the user" on public.routines;
create policy "routines are owned by the user"
  on public.routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "admins can read their own admin assignment" on public.admin_users;
create policy "admins can read their own admin assignment"
  on public.admin_users for select
  using (auth.uid() = user_id);

drop policy if exists "signed-in users can submit feedback as themselves" on public.feedback;
create policy "signed-in users can submit feedback as themselves"
  on public.feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "admins can read feedback" on public.feedback;
create policy "admins can read feedback"
  on public.feedback for select
  using (exists (
    select 1 from public.admin_users where admin_users.user_id = auth.uid()
  ));

drop policy if exists "admins can update feedback status" on public.feedback;
create policy "admins can update feedback status"
  on public.feedback for update
  using (exists (
    select 1 from public.admin_users where admin_users.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.admin_users where admin_users.user_id = auth.uid()
  ));

-- Replace the signed-in user's complete dataset as one database transaction.
-- SECURITY INVOKER keeps the table grants and RLS policies in force.
create or replace function public.replace_gymnotes_state(p_state jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  profile_data jsonb;
begin
  if owner_id is null then
    raise exception 'Authentication required to replace GymNotes data';
  end if;
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'Invalid GymNotes state';
  end if;

  profile_data := coalesce(p_state->'profile', '{}'::jsonb);

  delete from public.habit_checks where user_id = owner_id;
  delete from public.habits where user_id = owner_id;
  delete from public.routines where user_id = owner_id;
  delete from public.workouts where user_id = owner_id;
  delete from public.custom_exercises where user_id = owner_id;

  insert into public.profiles (user_id, name, sex, age, height_cm, weight_kg, unit)
  values (
    owner_id,
    coalesce(profile_data->>'name', ''),
    coalesce(profile_data->>'sex', 'male'),
    nullif(profile_data->>'age', '')::integer,
    nullif(profile_data->>'heightCm', '')::numeric,
    nullif(profile_data->>'weightKg', '')::numeric,
    coalesce(profile_data->>'unit', 'kg')
  )
  on conflict (user_id) do update set
    name = excluded.name,
    sex = excluded.sex,
    age = excluded.age,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    unit = excluded.unit;

  insert into public.custom_exercises (id, user_id, name, muscle_group)
  select item->>'id', owner_id, item->>'name', item->>'group'
  from jsonb_array_elements(
    case when jsonb_typeof(p_state->'customExercises') = 'array'
      then p_state->'customExercises' else '[]'::jsonb end
  ) as items(item);

  insert into public.workouts (
    id, user_id, date, exercise_id, sets, bodyweight_kg, notes, created_at,
    session_id, session_name, superset_group, position
  )
  select
    item->>'id', owner_id, (item->>'date')::date, item->>'exerciseId',
    coalesce(item->'sets', '[]'::jsonb),
    nullif(item->>'bodyweightKg', '')::numeric,
    item->>'notes', coalesce(nullif(item->>'createdAt', '')::bigint, 0),
    nullif(item->>'sessionId', ''), nullif(item->>'sessionName', ''),
    nullif(item->>'supersetGroup', '')::integer,
    coalesce(nullif(item->>'position', '')::integer, 0)
  from jsonb_array_elements(
    case when jsonb_typeof(p_state->'workouts') = 'array'
      then p_state->'workouts' else '[]'::jsonb end
  ) as items(item);

  insert into public.habits (id, user_id, name, target_per_week, note, created_at)
  select
    item->>'id', owner_id, item->>'name',
    coalesce(nullif(item->>'targetPerWeek', '')::integer, 7),
    coalesce(item->>'note', ''), coalesce(nullif(item->>'createdAt', '')::bigint, 0)
  from jsonb_array_elements(
    case when jsonb_typeof(p_state->'habits') = 'array'
      then p_state->'habits' else '[]'::jsonb end
  ) as items(item);

  insert into public.habit_checks (id, user_id, habit_id, date, created_at)
  select
    item->>'id', owner_id, item->>'habitId', (item->>'date')::date,
    coalesce(nullif(item->>'createdAt', '')::bigint, 0)
  from jsonb_array_elements(
    case when jsonb_typeof(p_state->'habitChecks') = 'array'
      then p_state->'habitChecks' else '[]'::jsonb end
  ) as items(item);

  insert into public.routines (id, user_id, name, entries, created_at)
  select
    item->>'id', owner_id, item->>'name',
    case when jsonb_typeof(item->'entries') = 'array'
      then item->'entries' else '[]'::jsonb end,
    coalesce(nullif(item->>'createdAt', '')::bigint, 0)
  from jsonb_array_elements(
    case when jsonb_typeof(p_state->'routines') = 'array'
      then p_state->'routines' else '[]'::jsonb end
  ) as items(item);
end;
$$;

revoke all on function public.replace_gymnotes_state(jsonb) from public, anon;
grant execute on function public.replace_gymnotes_state(jsonb) to authenticated;

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

drop trigger if exists habits_touch_updated_at on public.habits;
create trigger habits_touch_updated_at
  before update on public.habits
  for each row execute function public.touch_updated_at();

drop trigger if exists habit_checks_touch_updated_at on public.habit_checks;
create trigger habit_checks_touch_updated_at
  before update on public.habit_checks
  for each row execute function public.touch_updated_at();

drop trigger if exists routines_touch_updated_at on public.routines;
create trigger routines_touch_updated_at
  before update on public.routines
  for each row execute function public.touch_updated_at();

drop trigger if exists feedback_touch_updated_at on public.feedback;
create trigger feedback_touch_updated_at
  before update on public.feedback
  for each row execute function public.touch_updated_at();

-- After creating your owner account, grant it access to the private inbox by
-- replacing the email below and running this once in the SQL editor:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_OWNER_LOGIN_EMAIL'
-- on conflict (user_id) do nothing;
