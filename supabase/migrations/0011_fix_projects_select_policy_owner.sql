-- 0011_fix_projects_select_policy_owner.sql
--
-- Bug fix: creating a project from the app failed with
--   `new row violates row-level security policy for table "projects"`.
--
-- Root cause: the app performs `.insert(...).select(...).single()`, which PostgREST
-- executes as INSERT ... RETURNING. Postgres evaluates the SELECT row-security policy
-- on the RETURNING row before the AFTER INSERT trigger (trg_project_owner_member)
-- has added the owner as a project member. The SELECT policy
-- "members and admins view projects" only allowed members/admins, so the brand-new
-- project failed the SELECT check and Postgres aborted the whole insert with the
-- (misleading) row-level-security error.
--
-- Fix: allow project owners to see their own projects as well.
--
-- Note: contributions, expenses and project_resources do not need this because their
-- creators are already project members at insert time (their INSERT policies require it).

drop policy if exists "members and admins view projects" on public.projects;

create policy "members owners and admins view projects"
  on public.projects
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or mm_is_project_member(id)
    or mm_is_system_admin()
  );
