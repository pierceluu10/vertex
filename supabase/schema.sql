-- Vertex Database Schema
-- Run this in the Supabase SQL editor to set up the database

-- Parents (extends auth.users)
create table if not exists parents (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  heygen_avatar_id text,
  created_at timestamptz default now()
);

-- Children
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
  file_name text not null,
  file_url text not null,
  extracted_text text,
  chunks jsonb,
  uploaded_at timestamptz default now()
);

-- Tutoring sessions
create table if not exists tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references children(id) on delete cascade not null,
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

-- Quiz attempts
create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references tutoring_sessions(id) on delete cascade not null,
  child_id uuid references children(id) on delete cascade not null,
  question text not null,
  child_answer text,
  correct_answer text not null,
  is_correct boolean,
  topic text,
  created_at timestamptz default now()
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
alter table children enable row level security;
alter table learning_profiles enable row level security;
alter table uploaded_documents enable row level security;
alter table tutoring_sessions enable row level security;
alter table messages enable row level security;
alter table quiz_attempts enable row level security;
alter table focus_events enable row level security;
alter table parent_reports enable row level security;

-- Policies: parents can only access their own data
create policy "Parents can view own profile" on parents for select using (auth.uid() = id);
create policy "Parents can update own profile" on parents for update using (auth.uid() = id);
create policy "Parents can insert own profile" on parents for insert with check (auth.uid() = id);

create policy "Parents can view own children" on children for select using (parent_id = auth.uid());
create policy "Parents can insert own children" on children for insert with check (parent_id = auth.uid());
create policy "Parents can update own children" on children for update using (parent_id = auth.uid());
create policy "Parents can delete own children" on children for delete using (parent_id = auth.uid());

create policy "Access own children learning profiles" on learning_profiles
  for all using (child_id in (select id from children where parent_id = auth.uid()));

create policy "Access own documents" on uploaded_documents
  for all using (parent_id = auth.uid());

create policy "Access own sessions" on tutoring_sessions
  for all using (child_id in (select id from children where parent_id = auth.uid()));

create policy "Access own messages" on messages
  for all using (session_id in (
    select id from tutoring_sessions where child_id in (
      select id from children where parent_id = auth.uid()
    )
  ));

create policy "Access own quiz attempts" on quiz_attempts
  for all using (child_id in (select id from children where parent_id = auth.uid()));

create policy "Access own focus events" on focus_events
  for all using (session_id in (
    select id from tutoring_sessions where child_id in (
      select id from children where parent_id = auth.uid()
    )
  ));

create policy "Access own reports" on parent_reports
  for all using (parent_id = auth.uid());

-- Indexes
create index idx_children_parent on children(parent_id);
create index idx_sessions_child on tutoring_sessions(child_id);
create index idx_messages_session on messages(session_id);
create index idx_focus_events_session on focus_events(session_id);
create index idx_documents_parent on uploaded_documents(parent_id);
