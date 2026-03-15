-- Attention Engine: add focus_timeline to sessions + create topic_mastery table

-- 1. Add focus_timeline column to sessions
alter table sessions add column if not exists focus_timeline jsonb default '[]'::jsonb;

-- 2. Topic mastery table (forgetting curve)
create table if not exists topic_mastery (
  id uuid primary key default gen_random_uuid(),
  kid_session_id uuid references kids_sessions(id) on delete cascade not null,
  topic text not null,
  confidence_score real default 100,
  last_active_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(kid_session_id, topic)
);

alter table topic_mastery enable row level security;

create policy "Topic mastery is readable" on topic_mastery
  for select using (true);

create policy "Topic mastery is insertable" on topic_mastery
  for insert with check (true);

create policy "Topic mastery is updatable" on topic_mastery
  for update using (true);

create index if not exists idx_topic_mastery_session on topic_mastery(kid_session_id);
create index if not exists idx_topic_mastery_topic on topic_mastery(kid_session_id, topic);
