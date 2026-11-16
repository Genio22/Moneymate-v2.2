-- =====================================================================
-- MoneyMate 0004 — Storage: private receipts bucket + access policies
-- Files: receipts/{project_id}/{user_id}/{filename}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg','image/jpg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];

-- helper: first path folder must look like a project uuid
create or replace function mm_storage_project_path(name text) returns uuid
language sql immutable as $$
  select case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (storage.foldername(name))[1]::uuid
    else null::uuid
  end
$$;

create or replace function mm_storage_uploader_path(name text) returns text
language sql immutable as $$
  select (storage.foldername(name))[2]
$$;

-- members upload receipts into their own folder inside an authorized project
create policy "members upload receipts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and mm_is_project_member(mm_storage_project_path(name))
    and mm_storage_uploader_path(name) = auth.uid()::text
  );

-- project members can read receipts of their project
create policy "members read receipts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and mm_is_project_member(mm_storage_project_path(name))
  );

-- uploader may replace their own files
create policy "uploaders update own receipts" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and mm_storage_uploader_path(name) = auth.uid()::text
  );

-- uploader or a project manager may delete
create policy "authorized delete receipts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (
      mm_storage_uploader_path(name) = auth.uid()::text
      or mm_is_project_manager(mm_storage_project_path(name))
    )
  );
