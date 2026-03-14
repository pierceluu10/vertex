-- Fix: Add child_name to parents (if missing) and create access_codes table
-- Run this in Supabase SQL Editor if you see schema cache errors for these.

-- 1. Add missing columns to parents (safe if column already exists)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS child_name text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS grade_level text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS math_topics text[] DEFAULT '{}';
ALTER TABLE parents ADD COLUMN IF NOT EXISTS learning_pace text DEFAULT 'medium';
ALTER TABLE parents ADD COLUMN IF NOT EXISTS notification_realtime boolean DEFAULT true;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS notification_daily boolean DEFAULT false;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS notification_daily_time text DEFAULT '18:00';
ALTER TABLE parents ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS heygen_avatar_id text;

-- 2. Create access_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS access_codes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references parents(id) on delete cascade not null,
  code text not null unique,
  child_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Enable RLS on access_codes
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- 4. Drop policies if they exist (so we can re-create without errors)
DROP POLICY IF EXISTS "Parents manage own access codes" ON access_codes;
DROP POLICY IF EXISTS "Anyone can read active access codes" ON access_codes;

-- 5. Create policies for access_codes
CREATE POLICY "Parents manage own access codes" ON access_codes
  FOR ALL USING (parent_id = auth.uid());

CREATE POLICY "Anyone can read active access codes" ON access_codes
  FOR SELECT USING (is_active = true);

-- 6. Indexes for access_codes
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);
CREATE INDEX IF NOT EXISTS idx_access_codes_parent ON access_codes(parent_id);
