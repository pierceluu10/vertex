-- Run this in Supabase Dashboard → SQL Editor to debug storage RLS
-- 1. List all storage policies on storage.objects
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 2. Ensure avatars bucket exists and is public
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';

-- 3. If policies look wrong, re-apply the avatars policy:
-- DROP POLICY IF EXISTS "Authenticated can upload to avatars" ON storage.objects;
-- CREATE POLICY "Authenticated can upload to avatars"
--   ON storage.objects FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'avatars');
