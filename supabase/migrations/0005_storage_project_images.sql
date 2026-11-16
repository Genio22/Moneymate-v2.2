-- =====================================================================
-- MoneyMate 0005 — Project images bucket (logos/cover photos)
-- These are non-financial, non-sensitive images; public read is fine.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 5242880,
        array['image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp'];

create policy "authenticated upload project images" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-images');

create policy "public read project images" on storage.objects
  for select using (bucket_id = 'project-images');

create policy "uploaders update own project images" on storage.objects
  for update to authenticated using (bucket_id = 'project-images' and owner = auth.uid());

create policy "uploaders delete own project images" on storage.objects
  for delete to authenticated using (bucket_id = 'project-images' and owner = auth.uid());
