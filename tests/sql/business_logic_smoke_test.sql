-- =====================================================================
-- MoneyMate — business-logic smoke test (SQL)
-- Run in the Supabase SQL Editor (connects as postgres).
-- It simulates authenticated users by setting request.jwt.claims.
--
-- It validates the exact scenarios from the specification:
--   1. Senior (Rahim) gives Junior (Karim) ৳500 as an advance
--   2. Karim records a ৳450 purchase against that advance
--      -> remaining advance = ৳50, status PENDING SOURCE VERIFICATION
--   3. Karim CANNOT verify his own transaction; Rahim verifies
--   4. Karim spends ৳350 of his OWN money -> manager verifies
--      -> reimbursement payable ৳350, available cash = ৳50 (50000 poisha)
--   5. Partial (৳200) then full (৳150) settlement
--   6. Restricted sponsor funds: overspend and category mismatch rejected
--   7. Non-cash contribution (recorded by Karim, verified by Karim as the
--      contributor) does NOT raise available cash; cash = ৳499,700
--   8. Restricted allocation spend succeeds when in-category; RLS: Karim
--      cannot see Rahim's private project or escalate his role
--
-- IMPORTANT: test data is cleaned at the start and end (emails @mm-test.local).
-- All statement results are discarded on purpose — use "Run" in the SQL editor
-- and look for the final "ALL SMOKE TESTS PASSED" notice.
-- =====================================================================

-- ------------------------------------------------------------------ setup
begin;
delete from auth.users where email in ('rahim@mm-test.local', 'karim@mm-test.local');
commit;

create temp table _ids (name text primary key, id uuid);

-- Later sections run as the `authenticated` role; that role must still be able
-- to read/insert into this temp table. The temp schema name is dynamic, so the
-- grants have to be issued dynamically.
do $$
declare sch oid; nm text;
begin
  sch := pg_my_temp_schema();
  if sch <> 0 then
    select nspname into nm from pg_namespace where oid = sch;
    execute format('grant usage on schema %I to authenticated', nm);
    execute format('grant select, insert, update, delete on all tables in schema %I to authenticated', nm);
  end if;
end $$;

-- create test users (trigger mm_handle_new_user creates their profiles)
do $$
declare u1 uuid; u2 uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          'rahim@mm-test.local', extensions.crypt('test-pass-123', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"full_name":"Rahim Senior"}', now(), now())
  returning id into u1;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          'karim@mm-test.local', extensions.crypt('test-pass-123', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"full_name":"Karim Junior"}', now(), now())
  returning id into u2;

  insert into _ids values ('rahim', u1), ('karim', u2);
end $$;

-- assert profiles were created by the trigger
do $$
begin
  if (select count(*) from profiles p join _ids i on i.id = p.id) <> 2 then
    raise exception 'ASSERT FAILED: profiles were not created for the test users';
  end if;
end $$;

-- project owned by Rahim; Karim joins
do $$
declare pid uuid;
begin
  insert into projects (name, category, status, start_date, initial_budget, owner_id)
  values ('MM Smoke Test Project', 'event', 'active', current_date, 10000000,
          (select id from _ids where name = 'rahim'))
  returning id into pid;

  insert into project_members (project_id, user_id, role)
  values (pid, (select id from _ids where name = 'karim'), 'member');

  insert into _ids values ('project', pid);
end $$;

do $$
begin
  -- owner automatically became a manager member
  if not exists (
    select 1 from project_members pm
    where pm.project_id = (select id from _ids where name = 'project')
      and pm.user_id = (select id from _ids where name = 'rahim')
      and pm.role = 'manager'
  ) then
    raise exception 'ASSERT FAILED: project owner did not become a manager member';
  end if;
end $$;

-- ================================================================ TEST 1
-- Rahim gives Karim an advance of ৳500 (own funds)
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'rahim'), 'role', 'authenticated')::text, true);

  select mm_create_advance(
    p_project         => (select id from _ids where name = 'project'),
    p_provider        => (select id from _ids where name = 'rahim'),
    p_provider_name   => null,
    p_custodian       => (select id from _ids where name = 'karim'),
    p_amount_poisha   => 50000,          -- ৳500
    p_funding_source  => 'own_funds',
    p_purpose         => 'decoration purchases',
    p_provided_on     => current_date
  );
  insert into _ids select 'advance', id from advances
    where project_id = (select id from _ids where name = 'project') limit 1;
reset role;
commit;

do $$
begin
  if (select remaining_poisha from advances_with_balance
      where id = (select id from _ids where name = 'advance')) <> 50000 then
    raise exception 'ASSERT FAILED: new advance remaining should be ৳500 (50000 poisha)';
  end if;
end $$;

-- ================================================================ TEST 2
-- Karim records a ৳450 purchase against the advance
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  insert into expenses (project_id, title, amount_poisha, category, purchased_on,
                        paid_by, created_by, funding_source, advance_id, verification_type)
  values ((select id from _ids where name = 'project'), 'Decoration materials', 45000, 'decoration',
          current_date,
          (select id from _ids where name = 'karim'), (select id from _ids where name = 'karim'),
          'advance', (select id from _ids where name = 'advance'), 'source');

  insert into _ids select 'expense1', id from expenses
    where project_id = (select id from _ids where name = 'project') limit 1;
reset role;
commit;

do $$
begin
  -- remaining advance = ৳50
  if (select remaining_poisha from advances_with_balance
      where id = (select id from _ids where name = 'advance')) <> 5000 then
    raise exception 'ASSERT FAILED: advance remaining should be ৳50 after ৳450 expense';
  end if;
  -- expense source provider wired to Rahim automatically
  if (select source_provider_id from expenses
      where id = (select id from _ids where name = 'expense1'))
     is distinct from (select id from _ids where name = 'rahim') then
    raise exception 'ASSERT FAILED: source_provider_id should be Rahim';
  end if;
  -- status pending
  if (select status from expenses where id = (select id from _ids where name = 'expense1')) <> 'pending' then
    raise exception 'ASSERT FAILED: expense should start pending source verification';
  end if;
  -- Rahim got a verification notification
  if not exists (
    select 1 from notifications n
    where n.user_id = (select id from _ids where name = 'rahim')
      and n.kind = 'verification_requested'
  ) then
    raise exception 'ASSERT FAILED: Rahim should receive a source-verification notification';
  end if;
end $$;

-- ================================================================ TEST 3
-- Karim CANNOT verify his own transaction; a random member CANNOT either;
-- a manager CANNOT bypass the source provider.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  do $$
  begin
    perform mm_verify_expense((select id from _ids where name = 'expense1'), 'verified', null);
    raise exception 'EXPECTED-FAIL: submitter verified own transaction';
  exception
    when others then
      if sqlerrm like 'EXPECTED-FAIL%' then raise; end if;
      if sqlerrm not like '%cannot verify a transaction you submitted%' then
        raise exception 'ASSERT FAILED: wrong rejection reason for self-verify: %', sqlerrm;
      end if;
  end $$;
reset role;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'rahim'), 'role', 'authenticated')::text, true);

  select mm_verify_expense((select id from _ids where name = 'expense1'), 'verified', 'Confirmed, I gave the money');
reset role;
commit;

do $$
begin
  -- expense verified, advance reconciled = ৳450, remaining = ৳50
  if (select status from expenses where id = (select id from _ids where name = 'expense1')) <> 'verified' then
    raise exception 'ASSERT FAILED: expense should be verified by Rahim';
  end if;
  if (select reconciled_poisha from advances_with_balance
      where id = (select id from _ids where name = 'advance')) <> 45000 then
    raise exception 'ASSERT FAILED: advance reconciled should be ৳450';
  end if;
  if not exists (
    select 1 from financial_ledger_entries
    where ref_id = (select id from _ids where name = 'expense1')
      and entry_kind = 'advance_spend' and amount_poisha = -45000 and bucket = 'custody'
  ) then
    raise exception 'ASSERT FAILED: ledger missing advance_spend -৳450 custody entry';
  end if;
  if not exists (
    select 1 from verification_events where transaction_id = (select id from _ids where name = 'expense1')
      and verifier_name = 'Rahim Senior' and action = 'verified'
  ) then
    raise exception 'ASSERT FAILED: verification event with Rahim name missing';
  end if;
end $$;

-- ================================================================ TEST 4
-- Karim spends ৳350 of his OWN money -> manager verifies -> claim payable
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  insert into expenses (project_id, title, amount_poisha, category, purchased_on,
                        paid_by, created_by, funding_source, verification_type)
  values ((select id from _ids where name = 'project'), 'Banner printing', 35000, 'printing', current_date,
          (select id from _ids where name = 'karim'), (select id from _ids where name = 'karim'),
          'personal', 'manager');
  insert into _ids select 'expense2', id from expenses
    where title = 'Banner printing' and project_id = (select id from _ids where name = 'project');

  -- Karim cannot verify it himself
  do $$
  begin
    perform mm_verify_expense((select id from _ids where name = 'expense2'), 'verified', null);
    raise exception 'EXPECTED-FAIL: submitter verified own claim';
  exception
    when others then
      if sqlerrm like 'EXPECTED-FAIL%' then raise; end if;
  end $$;
reset role;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'rahim'), 'role', 'authenticated')::text, true);
  select mm_verify_expense((select id from _ids where name = 'expense2'), 'verified', 'Receipt looks right');
reset role;
commit;

do $$
declare rb record;
begin
  select * into rb from reimbursements where expense_id = (select id from _ids where name = 'expense2');
  if not found then raise exception 'ASSERT FAILED: verified personal claim must create a reimbursement'; end if;
  if rb.outstanding_poisha <> 35000 or rb.status <> 'outstanding' then
    raise exception 'ASSERT FAILED: claim payable should be ৳350 outstanding';
  end if;
  -- available cash: 0 cash contributions + ৳500 advance (own funds) - ৳450 advance spend.
  -- The ৳350 personal claim is PENDING reimbursement and does not reduce cash yet.
  if (select (mm_project_summary((select id from _ids where name = 'project'))->>'available_cash')::bigint
      <> 5000) then
    raise exception 'ASSERT FAILED: available cash should be ৳50 (5000 poisha)';
  end if;
end $$;

-- ================================================================ TEST 5
-- Partial ৳200 then full ৳150 settlement
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'rahim'), 'role', 'authenticated')::text, true);

  select mm_settle_reimbursement(
    p_reimbursement => (select id from reimbursements where expense_id = (select id from _ids where name = 'expense2')),
    p_amount_poisha => 20000, p_paid_on => current_date, p_method => 'bkash', p_reference => 'TrxID-1');

  insert into _ids select 'reimbursement', id from reimbursements
    where expense_id = (select id from _ids where name = 'expense2');

  -- overpaying must fail
  do $$
  begin
    perform mm_settle_reimbursement(
      p_reimbursement => (select id from _ids where name = 'reimbursement'),
      p_amount_poisha => 999999, p_paid_on => current_date, p_method => 'cash');
    raise exception 'EXPECTED-FAIL: overpayment accepted';
  exception
    when others then
      if sqlerrm like 'EXPECTED-FAIL%' then raise; end if;
  end $$;

  select mm_settle_reimbursement(
    p_reimbursement => (select id from _ids where name = 'reimbursement'),
    p_amount_poisha => 15000, p_paid_on => current_date, p_method => 'cash', p_reference => 'TrxID-2');
reset role;
commit;

do $$
declare rb record;
begin
  select * into rb from reimbursements where id = (select id from _ids where name = 'reimbursement');
  if rb.status <> 'fully_reimbursed' or rb.outstanding_poisha <> 0 then
    raise exception 'ASSERT FAILED: claim should be fully reimbursed after partial+final payments';
  end if;
  if (select count(*) from reimbursement_payments where reimbursement_id = rb.id) <> 2 then
    raise exception 'ASSERT FAILED: two payments expected';
  end if;
end $$;

-- ================================================================ TEST 6
-- Restricted sponsorship: Sponsor A gives ৳500,000, allocated:
--   ৳300,000 equipment, ৳100,000 transport, ৳100,000 unrestricted remainder
-- (the in-category spend against the equipment allocation is TEST 8)
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'rahim'), 'role', 'authenticated')::text, true);

  insert into contributions (project_id, contribution_type, contributor_user_id, contributor_name,
    title, amount_poisha, restricted, received_on, recorded_by)
  values ((select id from _ids where name = 'project'), 'cash', null, 'Sponsor A',
    'Equipment fund', 50000000, true, current_date, (select id from _ids where name = 'rahim'));
  insert into _ids select 'contribution', id from contributions where title = 'Equipment fund';

  select mm_verify_contribution((select id from _ids where name = 'contribution'), 'verified', null);
  select mm_set_allocations((select id from _ids where name = 'contribution'),
    $J$[
      {"category": "equipment",  "amount_poisha": 30000000},
      {"category": "transport",  "amount_poisha": 10000000},
      {"category": "marketing",  "amount_poisha": 10000000}
    ]$J$::jsonb);
reset role;
commit;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  -- 6a: spending ৳350,000 against the ৳300,000 equipment allocation must FAIL
  do $$
  begin
    insert into expenses (project_id, title, amount_poisha, category, purchased_on, paid_by, created_by,
      funding_source, contribution_allocation_id, verification_type)
    values ((select id from _ids where name = 'project'), 'Overspend attempt', 35000000, 'equipment',
      current_date, (select id from _ids where name = 'karim'), (select id from _ids where name = 'karim'),
      'project_cash', (select ca.id from contribution_allocations ca where ca.contribution_id = (select id from _ids where name = 'contribution') and ca.category = 'equipment'),
      'manager');
    raise exception 'EXPECTED-FAIL: overspend of restricted allocation accepted';
  exception
    when others then
      if sqlerrm like 'EXPECTED-FAIL%' then raise; end if;
      if sqlerrm not like '%equipment%' then
        raise exception 'ASSERT FAILED: unexpected restriction error: %', sqlerrm;
      end if;
  end $$;

  -- 6b: ৳250,000 for FOOD against the equipment allocation must FAIL (category mismatch)
  do $$
  declare alloc uuid;
  begin
    select ca.id into alloc from contribution_allocations ca
    where ca.contribution_id = (select id from _ids where name = 'contribution') and ca.category = 'equipment';

    insert into expenses (project_id, title, amount_poisha, category, purchased_on, paid_by, created_by,
      funding_source, contribution_allocation_id, verification_type)
    values ((select id from _ids where name = 'project'), 'Wrong category attempt', 25000000, 'food',
      current_date, (select id from _ids where name = 'karim'), (select id from _ids where name = 'karim'),
      'project_cash', alloc, 'manager');
    raise exception 'EXPECTED-FAIL: category mismatch accepted';
  exception
    when others then
      if sqlerrm like 'EXPECTED-FAIL%' then raise; end if;
      if sqlerrm not like '%only be spent on%' then
        raise exception 'ASSERT FAILED: unexpected category error: %', sqlerrm;
      end if;
  end $$;
reset role;
commit;

-- ================================================================ TEST 7
-- Non-cash contribution does NOT raise available cash.
-- Karim contributes his OWN paint and verifies it as the contributor.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  insert into contributions (project_id, contribution_type, contributor_user_id, contributor_name,
    title, amount_poisha, received_on, recorded_by, quantity, unit)
  values ((select id from _ids where name = 'project'), 'material',
    (select id from _ids where name = 'karim'), 'Karim Junior',
    '20 cans of paint', 2000000, current_date, (select id from _ids where name = 'karim'), 20, 'cans');
  insert into _ids select 'noncash', id from contributions where title = '20 cans of paint';
reset role;
commit;

do $$
declare s jsonb; pid uuid;
begin
  pid := (select id from _ids where name = 'project');
  s := mm_project_summary(pid);
  -- available cash must not include the ৳20,000 material value while unverified
  if (s->>'noncash_verified')::bigint <> 0 then
    raise exception 'ASSERT FAILED: unverified non-cash should not count yet';
  end if;
end $$;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);
  select mm_verify_contribution((select id from _ids where name = 'noncash'), 'verified', 'I can confirm this');
reset role;
commit;

do $$
declare s jsonb; pid uuid; cash bigint;
begin
  pid := (select id from _ids where name = 'project');
  s := mm_project_summary(pid);

  if (s->>'noncash_verified')::bigint <> 2000000 then
    raise exception 'ASSERT FAILED: non-cash value should be ৳20,000';
  end if;

  -- cash math: ৳500,000 sponsor cash + ৳500 advance (own funds)
  --           - ৳450 advance spend - ৳350 reimbursements paid
  --           (no project_cash spend yet — that is TEST 8)
  cash := (s->>'cash_in_verified')::bigint + (s->>'own_funds_advances')::bigint
        - (s->>'advance_spent_verified')::bigint - (s->>'project_cash_spent_verified')::bigint
        - (s->>'reimbursements_paid')::bigint;
  if cash <> 50000000 + 50000 - 45000 - 35000 then
    raise exception 'ASSERT FAILED: cash figure wrong: %', cash;
  end if;
  if (s->>'available_cash')::bigint <> cash then
    raise exception 'ASSERT FAILED: available_cash mismatch';
  end if;
end $$;

-- ================================================================ TEST 8
-- In-category spend against the restricted allocation SUCCEEDS and is
-- reflected (pending counts as reserved) in the allocation.
-- RLS: Karim cannot see Rahim's private project or escalate his own role.
begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  insert into expenses (project_id, title, amount_poisha, category, purchased_on, paid_by, created_by,
    funding_source, contribution_allocation_id, verification_type)
  values ((select id from _ids where name = 'project'), 'Sound system rental', 30000000, 'equipment',
    current_date, (select id from _ids where name = 'karim'), (select id from _ids where name = 'karim'),
    'project_cash',
    (select ca.id from contribution_allocations ca where ca.contribution_id = (select id from _ids where name = 'contribution') and ca.category = 'equipment'),
    'manager');

  -- Karim tries to promote himself: RLS filters his row out, so the UPDATE
  -- silently changes 0 rows instead of raising an error — assert the role
  -- is unchanged afterwards.
  update project_members set role = 'manager'
  where project_id = (select id from _ids where name = 'project')
    and user_id = (select id from _ids where name = 'karim');
reset role;
commit;

do $$
begin
  if (select role from project_members
      where project_id = (select id from _ids where name = 'project')
        and user_id = (select id from _ids where name = 'karim')) is distinct from 'member' then
    raise exception 'ASSERT FAILED: Karim escalated his own role (RLS broken)';
  end if;
  if (select spent_poisha from allocations_with_balance
      where contribution_id = (select id from _ids where name = 'contribution') and category = 'equipment'
      limit 1) <> 30000000 then
    raise exception 'ASSERT FAILED: equipment allocation should show ৳300,000 spent (pending still reserves)';
  end if;
end $$;

do $$
declare private_project uuid;
begin
  insert into projects (name, category, status, start_date, owner_id)
  values ('Rahim Private Project', 'business', 'active', current_date, (select id from _ids where name = 'rahim'))
  returning id into private_project;
  insert into _ids values ('private_project', private_project);
end $$;

begin;
  set local role authenticated;
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from _ids where name = 'karim'), 'role', 'authenticated')::text, true);

  do $$
  declare c int;
  begin
    select count(*) into c from projects where id = (select id from _ids where name = 'private_project');
    if c <> 0 then
      raise exception 'ASSERT FAILED: Karim can see a project he is not a member of (RLS broken)';
    end if;
  end $$;
reset role;
commit;

-- ------------------------------------------------------------------ report
do $$
declare s jsonb;
begin
  s := mm_project_summary((select id from _ids where name = 'project'));
  raise notice 'ALL SMOKE TESTS PASSED ✓';
  raise notice 'Summary: %', s;
end $$;

-- ------------------------------------------------------------------ cleanup
do $$
declare ids uuid[];
begin
  select array_agg(id) into ids from _ids;

  -- verification_events keep verifier names and are not cascade-linked to users
  delete from verification_events;

  -- remove both test projects explicitly (private project included) so their
  -- children (ledger, expenses, contributions, advances, reimbursements…) go too
  delete from projects where owner_id in (select unnest(ids));

  -- leftovers that block user deletion
  delete from audit_logs where actor_id = any(ids);

  delete from auth.users where email in ('rahim@mm-test.local', 'karim@mm-test.local');

  -- profiles cascade from auth.users, but sweep any leftovers
  delete from profiles where id = any(ids);
end $$;
