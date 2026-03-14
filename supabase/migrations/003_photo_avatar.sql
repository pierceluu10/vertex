-- Add photo avatar (talking photo) support for parents
-- Photo avatars work with video generation (Studio API), not streaming
alter table parents add column if not exists heygen_talking_photo_id text;
