-- =====================================================================
-- MoneyMate 0007 — Realtime for notifications
-- The app subscribes to postgres_changes on public.notifications
-- (src/services/notifications.js). Supabase Realtime only streams
-- changes for tables that are members of the `supabase_realtime`
-- publication — it is empty by default.
-- RLS still applies: subscribers authorize with their own JWT, and the
-- table's SELECT policy (own rows only) gates what they receive.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
