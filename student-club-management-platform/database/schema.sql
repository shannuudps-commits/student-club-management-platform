-- CampusClubs schema. Run this entire file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null unique check (email = lower(email)),
  password_hash text not null,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 1 and 1000),
  category text not null check (char_length(category) between 1 and 60),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 1 and 1500),
  location text not null check (char_length(location) between 1 and 160),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 10000),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists idx_events_starts_at on public.events(starts_at);
create index if not exists idx_events_club_id on public.events(club_id);
create index if not exists idx_registrations_user_id on public.registrations(user_id);
create index if not exists idx_registrations_event_id on public.registrations(event_id);

-- Capacity is checked under a row lock to avoid overbooking when students register simultaneously.
create or replace function public.register_for_event(p_event_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  current_count integer;
  new_registration_id uuid;
begin
  select * into target_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if target_event.starts_at <= now() then raise exception 'EVENT_PASSED'; end if;

  select count(*) into current_count from public.registrations where event_id = p_event_id;
  if current_count >= target_event.capacity then raise exception 'EVENT_FULL'; end if;

  insert into public.registrations(user_id, event_id)
  values (p_user_id, p_event_id)
  returning id into new_registration_id;
  return new_registration_id;
exception
  when unique_violation then raise exception 'ALREADY_REGISTERED';
end;
$$;

-- This project uses a server-only Supabase service-role key. RLS is enabled as defense in depth;
-- browser clients have no Supabase key and cannot query these tables directly. The Express API
-- enforces user identity and role checks before using the privileged key.
alter table public.app_users enable row level security;
alter table public.clubs enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- Do not create anon/authenticated policies. The backend service-role key bypasses RLS,
-- so its authorization checks are essential and must never be removed or moved to the browser.
