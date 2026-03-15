-- Add all access_codes columns expected by the app (fixes "child_age" schema cache error)
-- Safe to run multiple times (IF NOT EXISTS).

alter table access_codes add column if not exists child_age integer check (child_age is null or (child_age >= 3 and child_age <= 18));
alter table access_codes add column if not exists grade_level text;
alter table access_codes add column if not exists math_topics text[] default '{}';
alter table access_codes add column if not exists learning_pace text default 'medium' check (learning_pace is null or learning_pace in ('slow', 'medium', 'fast'));
alter table access_codes add column if not exists learning_goals text;
