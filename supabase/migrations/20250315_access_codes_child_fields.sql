-- Access codes are child-based: require child name, age, grade, and math info
-- Run in Supabase SQL Editor

alter table access_codes add column if not exists child_age integer check (child_age is null or (child_age >= 3 and child_age <= 18));
alter table access_codes add column if not exists grade_level text;
alter table access_codes add column if not exists math_topics text[] default '{}';
alter table access_codes add column if not exists learning_pace text default 'medium' check (learning_pace is null or learning_pace in ('slow', 'medium', 'fast'));
