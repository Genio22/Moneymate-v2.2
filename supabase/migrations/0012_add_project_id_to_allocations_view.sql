-- 0012_add_project_id_to_allocations_view.sql
--
-- Bug fix: the app filters allocations per project
-- (src/services/contributions.js allocationsApi.listByProject uses
-- `.eq('project_id', projectId)`), but the allocations_with_balance view did
-- not expose project_id, so every allocations query failed with
--   "Column allocations_with_balance.project_id does not exist".
--
-- Recreate the view with project_id (via contributions), same shape otherwise,
-- still security_invoker so RLS applies.

drop view if exists public.allocations_with_balance;

create view public.allocations_with_balance
with (security_invoker = true) as
  select
    ca.id,
    ca.contribution_id,
    c.project_id,
    ca.category,
    ca.amount_poisha,
    ca.note,
    ca.created_by,
    ca.created_at,
    c.title as contribution_title,
    c.contributor_name,
    ca.amount_poisha - coalesce(sum(e.amount_poisha) filter (where e.status <> 'rejected'), 0) as remaining_poisha,
    coalesce(sum(e.amount_poisha) filter (where e.status <> 'rejected'), 0) as spent_poisha
  from contribution_allocations ca
  join contributions c on c.id = ca.contribution_id
  left join expenses e on e.contribution_allocation_id = ca.id
  group by ca.id, c.id;
