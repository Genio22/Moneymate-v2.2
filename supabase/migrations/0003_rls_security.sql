-- =====================================================================
-- MoneyMate 0003 — Row Level Security
-- Authorization is enforced in PostgreSQL, never only in the UI.
-- =====================================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_invitations enable row level security;
alter table contributions enable row level security;
alter table contribution_allocations enable row level security;
alter table advances enable row level security;
alter table expenses enable row level security;
alter table reimbursements enable row level security;
alter table reimbursement_payments enable row level security;
alter table project_resources enable row level security;
alter table resource_movements enable row level security;
alter table transaction_attachments enable row level security;
alter table verification_events enable row level security;
alter table financial_ledger_entries enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ---------------------------------------------------------------- profiles
create policy "profiles readable by authenticated" on profiles
  for select to authenticated using (true);

create policy "users update own profile" on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- nobody can grant themselves system admin
create or replace function mm_guard_profile_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_system_admin is distinct from old.is_system_admin and not mm_is_system_admin() then
    raise exception 'Only a system administrator can change administrator privileges.';
  end if;
  return new;
end $$;

create trigger trg_profile_admin_guard before update on profiles
for each row execute function mm_guard_profile_admin();

-- ---------------------------------------------------------------- projects
create policy "members and admins view projects" on projects
  for select to authenticated
  using (mm_is_project_member(id) or mm_is_system_admin());

create policy "users create own projects" on projects
  for insert to authenticated with check (owner_id = auth.uid());

create policy "managers update projects" on projects
  for update to authenticated using (mm_is_project_manager(id));

create policy "owners delete projects" on projects
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------- project_members
create policy "members view member list" on project_members
  for select to authenticated
  using (mm_is_project_member(project_id) or mm_is_system_admin());

create policy "managers update member roles" on project_members
  for update to authenticated using (mm_is_project_manager(project_id));

create policy "managers remove members / members can leave" on project_members
  for delete to authenticated
  using (mm_is_project_manager(project_id) or user_id = auth.uid());

-- no INSERT policy: joins happen exclusively through mm_join_by_code /
-- mm_accept_invitation / project creation trigger ( SECURITY DEFINER )

-- privilege escalation guard
create or replace function mm_guard_member_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from projects where id = new.project_id;

  if TG_OP = 'UPDATE' and new.role is distinct from old.role then
    if not mm_is_project_manager(new.project_id) then
      raise exception 'Only a project manager can change roles.';
    end if;
    if new.user_id = auth.uid() then
      raise exception 'You cannot change your own role.';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    if old.user_id = v_owner then
      raise exception 'The project owner cannot be removed. Close or transfer the project instead.';
    end if;
    if old.user_id <> auth.uid() and not mm_is_project_manager(old.project_id) then
      raise exception 'Only a project manager can remove members.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_member_guard before update or delete on project_members
for each row execute function mm_guard_member_change();

-- ---------------------------------------------------------------- project_invitations
create policy "members view invitations" on project_invitations
  for select to authenticated
  using (
    mm_is_project_member(project_id)
    or exists (select 1 from auth.users u where u.id = auth.uid() and u.email = project_invitations.email)
  );

create policy "managers manage invitations" on project_invitations
  for update to authenticated using (mm_is_project_manager(project_id));

create policy "managers delete invitations" on project_invitations
  for delete to authenticated using (mm_is_project_manager(project_id));

-- ---------------------------------------------------------------- contributions
create policy "members view contributions" on contributions
  for select to authenticated using (mm_is_project_member(project_id));

create policy "members record contributions" on contributions
  for insert to authenticated with check (
    recorded_by = auth.uid()
    and coalesce((select role from project_members pm where pm.project_id = contributions.project_id and pm.user_id = auth.uid()), 'viewer') in ('manager','member')
  );

create policy "recorder or manager edit pending contributions" on contributions
  for update to authenticated
  using (recorded_by = auth.uid() or mm_is_project_manager(project_id))
  with check (recorded_by = auth.uid() or mm_is_project_manager(project_id));

create policy "managers delete pending contributions" on contributions
  for delete to authenticated using (mm_is_project_manager(project_id) and status = 'pending');

-- verified contributions are financially immutable
create or replace function mm_guard_contribution_immutable() returns trigger
language plpgsql as $$
begin
  if old.status = 'verified' then
    raise exception 'Verified contributions cannot be modified. Record a correction instead.';
  end if;
  return new;
end $$;

create trigger trg_contribution_immutable before update or delete on contributions
for each row execute function mm_guard_contribution_immutable();

-- ---------------------------------------------------------------- contribution_allocations
create policy "members view allocations" on contribution_allocations
  for select to authenticated
  using (exists (select 1 from contributions c where c.id = contribution_id and mm_is_project_member(c.project_id)));

-- managed exclusively via mm_set_allocations ( SECURITY DEFINER )

-- ---------------------------------------------------------------- advances
create policy "members view advances" on advances
  for select to authenticated using (mm_is_project_member(project_id));

-- created/updated exclusively via mm_create_advance & co ( SECURITY DEFINER )

-- ---------------------------------------------------------------- expenses
create policy "members view expenses" on expenses
  for select to authenticated using (mm_is_project_member(project_id));

create policy "members record expenses" on expenses
  for insert to authenticated with check (
    created_by = auth.uid()
    and coalesce((select role from project_members pm where pm.project_id = expenses.project_id and pm.user_id = auth.uid()), 'viewer') in ('manager','member')
  );

create policy "creator edits pending expenses" on expenses
  for update to authenticated
  using (created_by = auth.uid() and status in ('pending','clarification'));

-- no DELETE policy: financial history is preserved. Rejection is the "undo".

-- ---------------------------------------------------------------- reimbursements
create policy "members view reimbursements" on reimbursements
  for select to authenticated using (mm_is_project_member(project_id));

-- settlement/creation exclusively via mm_settle_reimbursement & verification RPC

create policy "members view payments" on reimbursement_payments
  for select to authenticated
  using (exists (select 1 from reimbursements r where r.id = reimbursement_id and mm_is_project_member(r.project_id)));

-- ---------------------------------------------------------------- resources
create policy "members view resources" on project_resources
  for select to authenticated using (mm_is_project_member(project_id));

create policy "members create resources" on project_resources
  for insert to authenticated with check (
    created_by = auth.uid()
    and coalesce((select role from project_members pm where pm.project_id = project_resources.project_id and pm.user_id = auth.uid()), 'viewer') in ('manager','member')
  );

create policy "managers delete resources" on project_resources
  for delete to authenticated using (mm_is_project_manager(project_id));

-- updates via mm_update_resource ( SECURITY DEFINER )

create policy "members view resource movements" on resource_movements
  for select to authenticated
  using (exists (select 1 from project_resources r where r.id = resource_id and mm_is_project_member(r.project_id)));

-- ---------------------------------------------------------------- attachments
create policy "members view attachments" on transaction_attachments
  for select to authenticated using (mm_is_project_member(project_id));

create policy "members upload attachments" on transaction_attachments
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and coalesce((select role from project_members pm where pm.project_id = transaction_attachments.project_id and pm.user_id = auth.uid()), 'viewer') in ('manager','member')
  );

create policy "uploader or manager removes attachments" on transaction_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or mm_is_project_manager(project_id));

-- ---------------------------------------------------------------- verification events (immutable audit)
create policy "members view verification events" on verification_events
  for select to authenticated
  using (
    (transaction_type = 'expense' and exists (
      select 1 from expenses e where e.id = transaction_id and mm_is_project_member(e.project_id)))
    or
    (transaction_type = 'contribution' and exists (
      select 1 from contributions c where c.id = transaction_id and mm_is_project_member(c.project_id)))
  );

-- insert/update/delete happen ONLY inside SECURITY DEFINER functions.

-- ---------------------------------------------------------------- ledger
create policy "members view ledger" on financial_ledger_entries
  for select to authenticated using (mm_is_project_member(project_id));

-- ---------------------------------------------------------------- notifications
create policy "users view own notifications" on notifications
  for select to authenticated using (user_id = auth.uid());

create policy "users update own notifications" on notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own notifications" on notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- audit logs
create policy "admins view audit logs" on audit_logs
  for select to authenticated using (mm_is_system_admin());

-- audit logs are written only by SECURITY DEFINER helpers.
