-- Vertex Database Schema
-- Run this in the Supabase SQL editor to set up the database

-- Parents (extends auth.users)
create table if not exists parents (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  child_name text,
  grade_level text,
  math_topics text[] default '{}',
  learning_pace text default 'medium' check (learning_pace in ('slow', 'medium', 'fast')),
  notification_realtime boolean default true,
  notification_daily boolean default false,
  notification_daily_time text default '18:00',
  avatar_url text,
  heygen_avatar_id text,
  heygen_talking_photo_id text,
  created_at timestamptz default now()
);

-- Access codes (6-digit codes for kids to enter; one code per child, child info required)
create table if not exists access_codes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  code text not null unique,
  child_name text,
  child_age integer check (child_age is null or (child_age >= 3 and child_age <= 18)),
  grade_level text,
  math_topics text[] default '{}',
  learning_goals text,
  learning_pace text default 'medium' check (learning_pace is null or learning_pace in ('slow', 'medium', 'fast')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Add learning_goals if table already existed without it
alter table access_codes add column if not exists learning_goals text;

-- Kids sessions (created when a kid enters a valid code)
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

-- Children (legacy table kept for backward compatibility, also used for per-child profiles)
create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  name text not null,
  age integer not null check (age >= 3 and age <= 18),
  grade text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Learning profiles (one per child)
create table if not exists learning_profiles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete cascade not null unique,
  preferred_pace text default 'normal' check (preferred_pace in ('slow', 'normal', 'fast')),
  difficulty_level text default 'grade-level' check (difficulty_level in ('below-grade', 'grade-level', 'above-grade')),
  topics_struggled jsonb default '[]'::jsonb,
  topics_mastered jsonb default '[]'::jsonb,
  recent_mistakes jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Uploaded documents (homework PDFs)
create table if not exists uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  child_id uuid references children(id) on delete set null,
  kid_session_id uuid references kids_sessions(id) on delete set null,
  file_name text not null,
  file_url text not null,
  extracted_text text,
  chunks jsonb,
  uploaded_at timestamptz default now()
);

-- Sessions (focus tracking per study session)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  kid_session_id uuid references kids_sessions(id) on delete set null,
  focus_score integer default 100,
  study_duration integer default 0,
  distraction_events jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Tutoring sessions (chat-based tutoring)
create table if not exists tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete cascade,
  kid_session_id uuid references kids_sessions(id) on delete cascade,
  document_id uuid references uploaded_documents(id) on delete set null,
  status text default 'active' check (status in ('active', 'paused', 'completed')),
  session_summary text,
  focus_score_avg real,
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tutoring_sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  message_type text default 'chat' check (message_type in ('chat', 'quiz', 'hint', 'reminder')),
  metadata jsonb,
  created_at timestamptz default now()
);

-- Quizzes (structured quiz records)
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade,
  kid_session_id uuid references kids_sessions(id) on delete cascade,
  questions jsonb not null,
  answers jsonb,
  score integer,
  taken_at timestamptz default now()
);

-- Quiz attempts (individual question tracking)
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tutoring_sessions(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  kid_session_id uuid references kids_sessions(id) on delete cascade,
  question text not null,
  child_answer text,
  correct_answer text not null,
  is_correct boolean,
  topic text,
  created_at timestamptz default now()
);

-- Homework
create table if not exists homework (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  kid_session_id uuid references kids_sessions(id) on delete set null,
  file_url text not null,
  parsed_text text,
  uploaded_at timestamptz default now()
);

-- Focus events
create table if not exists focus_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tutoring_sessions(id) on delete cascade not null,
  event_type text not null check (event_type in ('tab_blur', 'inactive', 'face_absent', 'no_response')),
  duration_ms integer,
  intervention text,
  created_at timestamptz default now()
);

-- Parent reports
create table if not exists parent_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tutoring_sessions(id) on delete cascade not null,
  parent_id uuid references parents(id) on delete cascade not null,
  summary text not null,
  topics_covered jsonb,
  struggles jsonb,
  focus_summary jsonb,
  quiz_results jsonb,
  suggestions text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security
alter table parents enable row level security;
alter table access_codes enable row level security;
alter table kids_sessions enable row level security;
alter table children enable row level security;
alter table learning_profiles enable row level security;
alter table uploaded_documents enable row level security;
alter table sessions enable row level security;
alter table tutoring_sessions enable row level security;
alter table messages enable row level security;
alter table quizzes enable row level security;
alter table quiz_attempts enable row level security;
alter table homework enable row level security;
alter table focus_events enable row level security;
alter table parent_reports enable row level security;

-- Policies: parents can only access their own data
create policy "Parents can view own profile" on parents for select using (auth.uid() = id);
create policy "Parents can update own profile" on parents for update using (auth.uid() = id);
create policy "Parents can insert own profile" on parents for insert with check (auth.uid() = id);

create policy "Parents manage own access codes" on access_codes
  for all using (parent_id = auth.uid());

create policy "Anyone can read active access codes" on access_codes
  for select using (is_active = true);

create policy "Kids sessions are readable" on kids_sessions
  for select using (true);

create policy "Kids sessions are insertable" on kids_sessions
  for insert with check (true);

create policy "Kids sessions are updatable" on kids_sessions
  for update using (true);

create policy "Parents can view own children" on children for select using (parent_id = auth.uid());
create policy "Parents can insert own children" on children for insert with check (parent_id = auth.uid());
create policy "Parents can update own children" on children for update using (parent_id = auth.uid());
create policy "Parents can delete own children" on children for delete using (parent_id = auth.uid());

create policy "Access own children learning profiles" on learning_profiles
  for all using (child_id in (select id from children where parent_id = auth.uid()));

create policy "Access own documents" on uploaded_documents
  for all using (parent_id = auth.uid());

create policy "Access own focus sessions" on sessions
  for all using (parent_id = auth.uid());

create policy "Access own tutoring sessions" on tutoring_sessions
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
    or kid_session_id in (select id from kids_sessions where parent_id = auth.uid())
  );

create policy "Tutoring sessions insertable" on tutoring_sessions
  for insert with check (true);

create policy "Access own messages" on messages
  for all using (true);

create policy "Access own quizzes" on quizzes
  for all using (true);

create policy "Access own quiz attempts" on quiz_attempts
  for all using (true);

create policy "Access homework" on homework
  for all using (true);

create policy "Access own focus events" on focus_events
  for all using (true);

create policy "Access own reports" on parent_reports
  for all using (parent_id = auth.uid());

-- Indexes
create index if not exists idx_children_parent on children(parent_id);
create index if not exists idx_sessions_child on tutoring_sessions(child_id);
create index if not exists idx_messages_session on messages(session_id);
create index if not exists idx_focus_events_session on focus_events(session_id);
create index if not exists idx_documents_parent on uploaded_documents(parent_id);
create index if not exists idx_access_codes_code on access_codes(code);
create index if not exists idx_access_codes_parent on access_codes(parent_id);
create index if not exists idx_kids_sessions_parent on kids_sessions(parent_id);
create index if not exists idx_kids_sessions_code on kids_sessions(code_used);
create index if not exists idx_quizzes_parent on quizzes(parent_id);
create index if not exists idx_homework_parent on homework(parent_id);
