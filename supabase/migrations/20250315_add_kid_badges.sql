-- Kid badges table: tracks earned badges per kid session
create table if not exists kid_badges (
  id uuid primary key default gen_random_uuid(),
  kid_session_id uuid references kids_sessions(id) on delete cascade not null,
  badge_id text not null,
  earned_at timestamptz default now(),
  unique(kid_session_id, badge_id)
);

alter table kid_badges enable row level security;

create policy "Kid badges are readable" on kid_badges
  for select using (true);

create policy "Kid badges are insertable" on kid_badges
  for insert with check (true);

create index if not exists idx_kid_badges_session on kid_badges(kid_session_id);
