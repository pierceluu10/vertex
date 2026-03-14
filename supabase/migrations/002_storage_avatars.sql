-- Avatars bucket and policies for client-side video uploads (avoids server body size limits)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

drop policy if exists "Parents can upload own avatars" on storage.objects;
drop policy if exists "Authenticated can upload to avatars" on storage.objects;
create policy "Authenticated can upload to avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Avatar files are publicly readable" on storage.objects;
create policy "Avatar files are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'avatars');
