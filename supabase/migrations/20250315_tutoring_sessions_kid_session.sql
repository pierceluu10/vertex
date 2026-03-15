-- Add kid_session_id to tutoring_sessions so sessions can be linked to kids_sessions
alter table tutoring_sessions
  add column if not exists kid_session_id uuid references kids_sessions(id) on delete cascade;

create index if not exists idx_tutoring_sessions_kid_session
  on tutoring_sessions(kid_session_id);
