-- Add lesson_plan column to uploaded_documents for storing AI-generated lesson plans
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS lesson_plan jsonb DEFAULT NULL;
