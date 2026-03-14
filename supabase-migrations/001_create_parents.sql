-- Run this in Supabase SQL Editor so the app's signup and dashboard work.
-- The app uses "parents" for account info (not "profiles"). id must be uuid to match auth.users.id.

create table if not exists public.parents (
  id uuid primary key default auth.uid(),
  full_name text not null,
  email text not null,
  avatar_url text,
  heygen_avatar_id text,
  created_at timestamptz default now()
);

alter table public.parents
  enable row level security;

drop policy if exists "Users can view own parent profile" on public.parents;
create policy "Users can view own parent profile"
  on public.parents for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own parent profile" on public.parents;
create policy "Users can insert own parent profile"
  on public.parents for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own parent profile" on public.parents;
create policy "Users can update own parent profile"
  on public.parents for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
