-- 0010_cascade_safe_guards.sql
--
-- Bug fix: the BEFORE triggers that protect contributions and project memberships
-- from illegal direct changes also fired during ON DELETE CASCADE deletions
-- (deleting a project cascades to its members and contributions). The guards
-- rejected the cascaded rows, which made project deletion fail.
--
-- Fixes:
--   1. Both guards short-circuit when pg_trigger_depth() > 1, i.e. when the change is
--      itself the result of a cascaded delete, letting the cascade proceed.
--   2. mm_guard_contribution_immutable is a BEFORE DELETE trigger and must return OLD
--      (returning NEW, which is NULL for a DELETE, aborted legitimate deletes).

create or replace function public.mm_guard_contribution_immutable()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Cascaded deletes (project or account deletion) are allowed to proceed.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if TG_OP = 'DELETE' then
    if old.status = 'verified' then
      raise exception 'Verified contributions cannot be deleted. Record a correction instead.';
    end if;
    return old;  -- BEFORE DELETE must return OLD, not NEW (null)
  end if;

  if old.status = 'verified' then
    raise exception 'Verified contributions cannot be modified. Record a correction instead.';
  end if;
  return new;
end $function$;

create or replace function public.mm_guard_member_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_owner uuid;
begin
  -- Cascaded deletes (project or account deletion) are allowed.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if TG_OP = 'DELETE' then
    select owner_id into v_owner from projects where id = old.project_id;
    if old.user_id = v_owner then
      raise exception 'The project owner cannot be removed. Close or transfer the project instead.';
    end if;
    if old.user_id <> auth.uid() and not mm_is_project_manager(old.project_id) then
      raise exception 'Only a project manager can remove members.';
    end if;
  end if;

  if TG_OP = 'UPDATE' and new.role is distinct from old.role then
    if not mm_is_project_manager(new.project_id) then
      raise exception 'Only a project manager can change roles.';
    end if;
    if new.user_id = auth.uid() then
      raise exception 'You cannot change your own role.';
    end if;
  end if;

  return coalesce(new, old);
end $function$;
