-- Create kids_sessions table (required for student code login)
-- Run this in Supabase SQL Editor if you see: Could not find the table 'public.kids_sessions'

create table if not exists kids_sessions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  code_used text not null,
  child_name text,
  avatar_choice text,
  streak_count integer default 0,
  xp_points integer default 0,
  last_active_date date,
  created_at timestamptz default now()
);

alter table kids_sessions enable row level security;

drop policy if exists "Kids sessions are readable" on kids_sessions;
drop policy if exists "Kids sessions are insertable" on kids_sessions;
drop policy if exists "Kids sessions are updatable" on kids_sessions;

create policy "Kids sessions are readable" on kids_sessions
  for select using (true);

create policy "Kids sessions are insertable" on kids_sessions
  for insert with check (true);

create policy "Kids sessions are updatable" on kids_sessions
  for update using (true);

create index if not exists idx_kids_sessions_parent on kids_sessions(parent_id);
create index if not exists idx_kids_sessions_code on kids_sessions(code_used);
