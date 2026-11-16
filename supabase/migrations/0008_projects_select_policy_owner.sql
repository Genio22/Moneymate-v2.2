-- =====================================================================
-- MoneyMate 0008 — Owners can see their own projects
-- Fix: INSERT ... RETURNING (PostgREST .insert().select()) evaluates the
-- SELECT policy on the returned row BEFORE the AFTER INSERT trigger
-- (trg_project_owner_member) has added the owner as a project member.
-- A brand-new project therefore failed the SELECT policy and PostgREST
-- surfaced the misleading error "new row violates row-level security
-- policy for table projects". Allow owners to see their own projects.
-- (Applied via the SQL Editor on 2026-11-13; recorded here for parity.)
-- =====================================================================

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
