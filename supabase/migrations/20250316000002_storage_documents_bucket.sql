-- Create "documents" storage bucket for homework/PDF uploads
insert into storage.buckets (id, name, public) values ('documents', 'documents', true)
  on conflict (id) do nothing;

-- Authenticated users can upload files to the documents bucket
drop policy if exists "Authenticated can upload to documents" on storage.objects;
create policy "Authenticated can upload to documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents');

-- Document files are publicly readable (for serving file_url to dashboards)
drop policy if exists "Document files are publicly readable" on storage.objects;
create policy "Document files are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'documents');
