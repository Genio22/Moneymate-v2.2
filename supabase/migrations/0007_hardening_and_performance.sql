-- =====================================================================
-- MoneyMate 0007 — Hardening & performance
-- 1) Function EXECUTE hardening (advisor lint 0028/0029)
-- 2) RLS initplan optimization: (select auth.uid()) (advisor lint 0003)
-- 3) Missing FK indexes (advisor lint 0001)
-- NOTE: applied to the remote project as `hardening_and_performance`,
--       `hardening_storage_policies` and `initplan_invitation_policy`.
-- =====================================================================

-- ---------------------------------------------------------------
-- 1) FUNCTION EXECUTE HARDENING
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  -- a) Internal-only helpers, called solely from SECURITY DEFINER code
  --    (effective role is the function owner = postgres)
  for r in
    select p.oid from pg_proc p, pg_namespace n
    where p.pronamespace = n.oid and n.nspname = 'public'
      and p.proname in ('mm_audit','mm_notify')
  loop
    execute format('revoke execute on function %s from public', r.oid::regprocedure);
  end loop;

  -- b) Trigger helpers that fire during DIRECT DML performed by
  --    authenticated users (expenses insert, member changes, profile edits,
  --    project creation). Must stay executable for authenticated only.
  for r in
    select p.oid from pg_proc p, pg_namespace n
    where p.pronamespace = n.oid and n.nspname = 'public'
      and p.proname in (
        'mm_check_advance_spend','mm_check_allocation_spend','mm_expense_notify',
        'mm_guard_member_change','mm_guard_profile_admin','mm_owner_becomes_member')
  loop
    execute format('revoke execute on function %s from public, anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
  end loop;

  -- c) Signup trigger: only the Supabase auth service may execute it
  execute 'revoke execute on function public.mm_handle_new_user() from public, anon, authenticated';
  execute 'grant execute on function public.mm_handle_new_user() to supabase_auth_admin';

  -- d) Client-facing RPCs: authenticated only.
  --    Every one of these performs its own auth.uid()/membership checks inside.
  for r in
    select p.oid from pg_proc p, pg_namespace n
    where p.pronamespace = n.oid and n.nspname = 'public'
      and p.proname in (
        'mm_accept_invitation','mm_confirm_advance','mm_create_advance','mm_invite_member',
        'mm_join_by_code','mm_project_summary','mm_set_allocations','mm_settle_reimbursement',
        'mm_update_resource','mm_verify_contribution','mm_verify_expense')
  loop
    execute format('revoke execute on function %s from public, anon', r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated', r.oid::regprocedure);
  end loop;

  -- e) Policy helper functions: used inside RLS policies, which are
  --    evaluated for both anon and authenticated roles.
  for r in
    select p.oid from pg_proc p, pg_namespace n
    where p.pronamespace = n.oid and n.nspname = 'public'
      and p.proname in ('mm_is_project_member','mm_is_project_manager','mm_is_system_admin','mm_project_role')
  loop
    execute format('revoke execute on function %s from public', r.oid::regprocedure);
    execute format('grant execute on function %s to anon, authenticated', r.oid::regprocedure);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 2) RLS POLICY REWRITES — initplan-safe auth.uid()
-- ---------------------------------------------------------------

-- profiles
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

-- projects
drop policy if exists "owners delete projects" on public.projects;
create policy "owners delete projects" on public.projects
  for delete to authenticated
  using ( owner_id = (select auth.uid()) );

drop policy if exists "users create own projects" on public.projects;
create policy "users create own projects" on public.projects
  for insert to authenticated
  with check ( owner_id = (select auth.uid()) );

-- project_members
drop policy if exists "managers remove members / members can leave" on public.project_members;
create policy "managers remove members / members can leave" on public.project_members
  for delete to authenticated
  using ( mm_is_project_manager(project_id) or user_id = (select auth.uid()) );

-- project_invitations
-- NOTE: replaced the auth.users sub-select (invisible through RLS for the
-- authenticated role) with a direct JWT email comparison — same intent,
-- faster, and actually functional.
drop policy if exists "members view invitations" on public.project_invitations;
create policy "members view invitations" on public.project_invitations
  for select to authenticated
  using (
    mm_is_project_member(project_id)
    or coalesce(((select auth.jwt()) ->> 'email'), '') = project_invitations.email
  );

-- contributions
drop policy if exists "members record contributions" on public.contributions;
create policy "members record contributions" on public.contributions
  for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and coalesce((
      select pm.role from public.project_members pm
      where pm.project_id = contributions.project_id
        and pm.user_id = (select auth.uid())
    ), 'viewer'::member_role) in ('manager','member')
  );

drop policy if exists "recorder or manager edit pending contributions" on public.contributions;
create policy "recorder or manager edit pending contributions" on public.contributions
  for update to authenticated
  using ( recorded_by = (select auth.uid()) or mm_is_project_manager(project_id) )
  with check ( recorded_by = (select auth.uid()) or mm_is_project_manager(project_id) );

-- expenses
drop policy if exists "members record expenses" on public.expenses;
create policy "members record expenses" on public.expenses
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((
      select pm.role from public.project_members pm
      where pm.project_id = expenses.project_id
        and pm.user_id = (select auth.uid())
    ), 'viewer'::member_role) in ('manager','member')
  );

drop policy if exists "creator edits pending expenses" on public.expenses;
create policy "creator edits pending expenses" on public.expenses
  for update to authenticated
  using ( created_by = (select auth.uid()) and status in ('pending','clarification') );

-- notifications
drop policy if exists "users view own notifications" on public.notifications;
create policy "users view own notifications" on public.notifications
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists "users delete own notifications" on public.notifications;
create policy "users delete own notifications" on public.notifications
  for delete to authenticated
  using ( user_id = (select auth.uid()) );

-- project_resources
drop policy if exists "members create resources" on public.project_resources;
create policy "members create resources" on public.project_resources
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and coalesce((
      select pm.role from public.project_members pm
      where pm.project_id = project_resources.project_id
        and pm.user_id = (select auth.uid())
    ), 'viewer'::member_role) in ('manager','member')
  );

-- transaction_attachments
drop policy if exists "members upload attachments" on public.transaction_attachments;
create policy "members upload attachments" on public.transaction_attachments
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and coalesce((
      select pm.role from public.project_members pm
      where pm.project_id = transaction_attachments.project_id
        and pm.user_id = (select auth.uid())
    ), 'viewer'::member_role) in ('manager','member')
  );

drop policy if exists "uploader or manager removes attachments" on public.transaction_attachments;
create policy "uploader or manager removes attachments" on public.transaction_attachments
  for delete to authenticated
  using ( uploaded_by = (select auth.uid()) or mm_is_project_manager(project_id) );

-- storage (initplan-safe rewrites)
drop policy if exists "members upload receipts" on storage.objects;
create policy "members upload receipts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and mm_is_project_member(mm_storage_project_path(name))
    and mm_storage_uploader_path(name) = (select auth.uid())::text
  );

drop policy if exists "uploaders update own receipts" on storage.objects;
create policy "uploaders update own receipts" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and mm_storage_uploader_path(name) = (select auth.uid())::text
  );

drop policy if exists "authorized delete receipts" on storage.objects;
create policy "authorized delete receipts" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (
      mm_storage_uploader_path(name) = (select auth.uid())::text
      or mm_is_project_manager(mm_storage_project_path(name))
    )
  );

drop policy if exists "uploaders update own project images" on storage.objects;
create policy "uploaders update own project images" on storage.objects
  for update to authenticated
  using ( bucket_id = 'project-images' and owner = (select auth.uid()) );

drop policy if exists "uploaders delete own project images" on storage.objects;
create policy "uploaders delete own project images" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'project-images' and owner = (select auth.uid()) );

-- ---------------------------------------------------------------
-- 3) MISSING FK INDEXES
-- ---------------------------------------------------------------
create index if not exists advances_created_by_idx on public.advances(created_by);
create index if not exists advances_custodian_id_idx on public.advances(custodian_id);
create index if not exists advances_provider_user_id_idx on public.advances(provider_user_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists contribution_allocations_created_by_idx on public.contribution_allocations(created_by);
create index if not exists contributions_contributor_user_id_idx on public.contributions(contributor_user_id);
create index if not exists contributions_recorded_by_idx on public.contributions(recorded_by);
create index if not exists contributions_verified_by_idx on public.contributions(verified_by);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists expenses_paid_by_idx on public.expenses(paid_by);
create index if not exists expenses_source_provider_id_idx on public.expenses(source_provider_id);
create index if not exists expenses_verified_by_idx on public.expenses(verified_by);
create index if not exists financial_ledger_entries_actor_id_idx on public.financial_ledger_entries(actor_id);
create index if not exists notifications_project_id_idx on public.notifications(project_id);
create index if not exists project_invitations_invited_by_idx on public.project_invitations(invited_by);
create index if not exists project_resources_created_by_idx on public.project_resources(created_by);
create index if not exists project_resources_custodian_id_idx on public.project_resources(custodian_id);
create index if not exists project_resources_owner_user_id_idx on public.project_resources(owner_user_id);
create index if not exists project_resources_source_contribution_id_idx on public.project_resources(source_contribution_id);
create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists reimbursement_payments_recorded_by_idx on public.reimbursement_payments(recorded_by);
create index if not exists reimbursements_payee_id_idx on public.reimbursements(payee_id);
create index if not exists resource_movements_custodian_id_idx on public.resource_movements(custodian_id);
create index if not exists resource_movements_recorded_by_idx on public.resource_movements(recorded_by);
create index if not exists transaction_attachments_project_id_idx on public.transaction_attachments(project_id);
create index if not exists transaction_attachments_uploaded_by_idx on public.transaction_attachments(uploaded_by);
create index if not exists verification_events_verifier_id_idx on public.verification_events(verifier_id);
