-- 0013: Fix notification deep links.
--
-- mm_notify callers pass app-relative project paths like
-- '/projects/<id>/verification', but every SPA route lives under '/app'
-- ('/app/projects/<id>/...'). Tapping such a notification navigated to a 404.
--
-- Fix in two parts:
--   1. Rewrite mm_notify to normalize p_link at insert time, so all future
--      notifications are stored with an '/app'-prefixed link.
--   2. One-time UPDATE of existing rows.

create or replace function mm_notify(
  p_user uuid, p_kind text, p_title text,
  p_body text default null, p_link text default null, p_project uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, project_id, kind, title, body, link)
  values (
    p_user, p_project, p_kind, p_title, p_body,
    case
      when p_link is null then null
      when p_link like 'http://%' or p_link like 'https://%' then p_link
      when p_link like '/app%' then p_link
      else '/app' || case when p_link like '/%' then '' else '/' end || p_link
    end
  );
end;
$$;

revoke all on function mm_notify(uuid, text, text, text, text, uuid) from public;
revoke all on function mm_notify(uuid, text, text, text, text, uuid) from anon, authenticated;
grant execute on function mm_notify(uuid, text, text, text, text, uuid) to service_role;

-- One-time repair of already-stored rows.
update notifications
set link = '/app' || link
where link like '/projects/%';
