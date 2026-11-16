-- =====================================================================
-- MoneyMate 0006 — Function hardening
-- Pin search_path on every mm_* function so SECURITY DEFINER functions
-- cannot be hijacked by search_path manipulation.
-- NOTE: applied to the remote project as migration `function_hardening`.
-- =====================================================================

do $$
declare
  r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'mm\_%' escape '\'
  loop
    execute format('alter function %s set search_path = public', r.oid::regprocedure);
  end loop;
end $$;
