-- =====================================================================
-- MoneyMate 0002 — Business logic
-- All financial state changes go through secure functions / triggers so
-- RLS alone never has to be trusted for multi-step integrity.
-- =====================================================================

-- ---------------------------------------------------------------- access helpers (used by RLS)
create or replace function mm_is_system_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_system_admin from profiles where id = auth.uid()), false);
$$;

create or replace function mm_project_role(p_project uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from project_members where project_id = p_project and user_id = auth.uid();
$$;

create or replace function mm_is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = auth.uid()
  );
$$;

create or replace function mm_is_project_manager(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from project_members
                   where project_id = p_project and user_id = auth.uid()), 'viewer') in ('manager')
  or exists (select 1 from projects where id = p_project and owner_id = auth.uid());
$$;

-- money formatting for friendly error messages (taka only)
create or replace function mm_fmt_money(p_poisha bigint) returns text
language sql immutable as $$
  select '৳' || to_char(p_poisha::numeric / 100, 'FM999,999,990.00');
$$;

-- ---------------------------------------------------------------- notification helper
create or replace function mm_notify(
  p_user uuid, p_kind text, p_title text, p_body text default null,
  p_link text default null, p_project uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into notifications (user_id, project_id, kind, title, body, link)
  values (p_user, p_project, p_kind, p_title, p_body, p_link);
end $$;

-- ---------------------------------------------------------------- audit helper
create or replace function mm_audit(
  p_action text, p_entity text, p_entity_id uuid, p_details jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
end $$;

-- ================================================================
-- EXPENSE GUARD TRIGGERS (run for every insert / update)
-- ================================================================

-- 1) Advance spending guard: never allow spending more than the
--    remaining advance balance; wire up the source verifier.
create or replace function mm_check_advance_spend() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_adv record;
  v_spent bigint;
  v_remaining bigint;
begin
  if new.funding_source = 'advance' then
    select * into v_adv from public.advances where id = new.advance_id for update;
    if not found then
      raise exception 'Selected advance was not found.';
    end if;
    if v_adv.status <> 'active' then
      raise exception 'This advance is no longer active.';
    end if;
    if v_adv.project_id <> new.project_id then
      raise exception 'The selected advance belongs to a different project.';
    end if;

    select coalesce(sum(amount_poisha), 0) into v_spent
    from public.expenses
    where advance_id = new.advance_id
      and status <> 'rejected'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    v_remaining := v_adv.amount_poisha - v_spent;
    if new.amount_poisha > v_remaining then
      raise exception using
        message = format('This exceeds the remaining advance balance. Only %s is left on advance %s.',
                         mm_fmt_money(v_remaining), v_adv.reference),
        errcode = 'P0001';
    end if;

    new.source_provider_id := v_adv.provider_user_id;
  end if;
  return new;
end $$;

create trigger trg_expense_advance_check
before insert or update of funding_source, advance_id, amount_poisha, project_id on expenses
for each row execute function mm_check_advance_spend();

-- 2) Restricted-fund guard: spending against a sponsor allocation must fit
--    the remaining allocation AND match its permitted category.
create or replace function mm_check_allocation_spend() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_alloc record;
  v_spent bigint;
  v_remaining bigint;
begin
  if new.contribution_allocation_id is null then
    new.restriction_exception := false;
    return new;
  end if;

  select ca.*, c.project_id as c_project, c.restricted, c.title as contribution_title
    into v_alloc
  from public.contribution_allocations ca
  join public.contributions c on c.id = ca.contribution_id
  where ca.id = new.contribution_allocation_id;

  if not found then
    raise exception 'Selected fund allocation was not found.';
  end if;
  if v_alloc.c_project <> new.project_id then
    raise exception 'The selected allocation belongs to a different project.';
  end if;

  select coalesce(sum(amount_poisha), 0) into v_spent
  from public.expenses
  where contribution_allocation_id = new.contribution_allocation_id
    and status <> 'rejected'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_remaining := v_alloc.amount_poisha - v_spent;
  if new.amount_poisha > v_remaining then
    raise exception using
      message = format('Restricted fund "%s (%s)" has only %s left for this purpose.',
                       v_alloc.contribution_title, v_alloc.category, mm_fmt_money(v_remaining)),
      errcode = 'P0001';
  end if;

  if new.category is distinct from v_alloc.category then
    raise exception using
      message = format('This restricted fund may only be spent on "%s". Change the purpose or pick another fund.',
                       v_alloc.category),
      errcode = 'P0001';
  end if;

  new.restriction_exception := false;
  return new;
end $$;

create trigger trg_expense_alloc_check
before insert or update of contribution_allocation_id, amount_poisha, project_id, category on expenses
for each row execute function mm_check_allocation_spend();

-- 3) Notify verifiers when a pending expense is submitted (or re-submitted).
create or replace function mm_expense_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mgr record;
  v_link text;
  v_provider uuid;
  v_title text;
begin
  v_link := '/projects/' || new.project_id || '/verification';
  v_title := mm_fmt_money(new.amount_poisha) || ' — ' || new.title;

  if TG_OP = 'INSERT' then
    if new.funding_source = 'advance' then
      -- Scenario A: money provided by another person -> source verification
      perform mm_notify(
        new.source_provider_id, 'verification_requested',
        'Verify a purchase paid with money you provided',
        coalesce((select full_name from profiles where id = new.created_by), 'A member')
          || ' spent ' || v_title || ' using the advance you provided.',
        v_link, new.project_id);
    else
      -- Scenario B: personal money -> manager verification
      for v_mgr in
        select pm.user_id from project_members pm
        where pm.project_id = new.project_id and pm.role = 'manager'
      loop
        if v_mgr.user_id <> new.created_by then
          perform mm_notify(
            v_mgr.user_id, 'verification_requested',
            'Reimbursement claim needs verification',
            coalesce((select full_name from profiles where id = new.created_by), 'A member')
              || ' claims ' || v_title || ' spent from personal funds.',
            v_link, new.project_id);
        end if;
      end loop;
    end if;
  elsif TG_OP = 'UPDATE' and new.status = 'pending' and old.status = 'clarification' then
    -- member responded to a clarification request: ask verifier again
    if new.funding_source = 'advance' then
      perform mm_notify(new.source_provider_id, 'verification_requested',
        'Updated purchase needs your verification', v_title, v_link, new.project_id);
    else
      for v_mgr in
        select pm.user_id from project_members pm
        where pm.project_id = new.project_id and pm.role = 'manager'
      loop
        if v_mgr.user_id <> new.created_by then
          perform mm_notify(v_mgr.user_id, 'verification_requested',
            'Updated claim needs your verification', v_title, v_link, new.project_id);
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

create trigger trg_expense_notify
after insert or update of status on expenses
for each row execute function mm_expense_notify();

-- ================================================================
-- VIEWS
-- ================================================================

create view advances_with_balance with (security_invoker = true) as
select
  a.*,
  a.amount_poisha - coalesce(sum(e.amount_poisha) filter (where e.status <> 'rejected'), 0) as remaining_poisha,
  coalesce(sum(e.amount_poisha) filter (where e.status = 'verified'), 0) as reconciled_poisha,
  coalesce(sum(e.amount_poisha) filter (where e.status in ('pending','clarification')), 0) as pending_poisha
from public.advances a
left join public.expenses e on e.advance_id = a.id
group by a.id;

create view allocations_with_balance with (security_invoker = true) as
select
  ca.*,
  c.title as contribution_title,
  c.contributor_name,
  ca.amount_poisha - coalesce(sum(e.amount_poisha) filter (where e.status <> 'rejected'), 0) as remaining_poisha,
  coalesce(sum(e.amount_poisha) filter (where e.status <> 'rejected'), 0) as spent_poisha
from public.contribution_allocations ca
join public.contributions c on c.id = ca.contribution_id
left join public.expenses e on e.contribution_allocation_id = ca.id
group by ca.id, c.id;

-- ================================================================
-- RPC: ADVANCES
-- ================================================================

create or replace function mm_create_advance(
  p_project uuid,
  p_provider uuid,            -- nullable = external provider
  p_provider_name text,
  p_custodian uuid,
  p_amount_poisha bigint,
  p_funding_source advance_funding,
  p_purpose text,
  p_provided_on date
) returns advances
language plpgsql security definer set search_path = public as $$
declare
  v_adv advances;
  v_provider_name text;
begin
  if not mm_is_project_member(p_project) then
    raise exception 'You are not a member of this project.';
  end if;
  if p_amount_poisha is null or p_amount_poisha <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;
  if p_custodian is null or not exists (select 1 from project_members where project_id = p_project and user_id = p_custodian) then
    raise exception 'The receiver must be a member of this project.';
  end if;
  if p_provider = p_custodian then
    raise exception 'The provider and the receiver must be different people.';
  end if;

  if p_provider is null then
    v_provider_name := coalesce(nullif(p_provider_name, ''), 'External provider');
  else
    if not exists (select 1 from project_members where project_id = p_project and user_id = p_provider)
       and not exists (select 1 from projects where id = p_project and owner_id = p_provider) then
      raise exception 'The provider must be a member of this project.';
    end if;
    select full_name into v_provider_name from profiles where id = p_provider;
  end if;

  insert into advances (project_id, provider_user_id, provider_name, custodian_id,
                        amount_poisha, funding_source, purpose, provided_on, created_by)
  values (p_project, p_provider, v_provider_name, p_custodian,
          p_amount_poisha, p_funding_source, p_purpose, coalesce(p_provided_on, current_date), auth.uid())
  returning * into v_adv;

  -- ledger: money physically sits with the custodian now
  if v_adv.funding_source = 'own_funds' then
    insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
      description, ref_type, ref_id, actor_id, entry_date)
    values (v_adv.project_id, 'advance_issue', 'custody', v_adv.amount_poisha,
      'Advance ' || v_adv.reference || ' to ' || (select full_name from profiles where id = v_adv.custodian_id),
      'advance', v_adv.id, auth.uid(), v_adv.provided_on);
  else
    insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
      description, ref_type, ref_id, actor_id, entry_date)
    values (v_adv.project_id, 'advance_transfer', 'main', -v_adv.amount_poisha,
      'Advance ' || v_adv.reference || ' drawn from project cash',
      'advance', v_adv.id, auth.uid(), v_adv.provided_on),
    (v_adv.project_id, 'advance_issue', 'custody', v_adv.amount_poisha,
      'Advance ' || v_adv.reference || ' handed to ' || (select full_name from profiles where id = v_adv.custodian_id),
      'advance', v_adv.id, auth.uid(), v_adv.provided_on);
  end if;

  perform mm_notify(v_adv.custodian_id, 'advance_received',
    'Advance recorded: ' || mm_fmt_money(v_adv.amount_poisha),
    v_adv.provider_name || ' provided ' || mm_fmt_money(v_adv.amount_poisha)
      || ' to you for: ' || coalesce(v_adv.purpose, 'project use') || '. Please confirm receipt.',
    '/projects/' || v_adv.project_id || '/advances', v_adv.project_id);

  perform mm_audit('advance.created', 'advance', v_adv.id,
    jsonb_build_object('amount', v_adv.amount_poisha, 'funding_source', v_adv.funding_source));

  return v_adv;
end $$;

create or replace function mm_confirm_advance(p_advance uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_adv advances;
begin
  select * into v_adv from advances where id = p_advance for update;
  if not found then raise exception 'Advance not found.'; end if;
  if v_adv.custodian_id <> auth.uid() then
    raise exception 'Only the person receiving the money can confirm it.';
  end if;
  update advances set custodian_confirmed_at = now() where id = p_advance;
end $$;

-- ================================================================
-- RPC: EXPENSE VERIFICATION (source-based + manager)
-- ================================================================

create or replace function mm_verify_expense(
  p_expense uuid, p_action verification_action, p_comment text default null
) returns expenses
language plpgsql security definer set search_path = public as $$
declare
  v_exp expenses;
  v_is_manager boolean;
  v_is_source boolean;
  v_link text;
  v_notifier uuid;
begin
  select * into v_exp from expenses where id = p_expense for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if v_exp.status not in ('pending','clarification') then
    raise exception 'This transaction was already processed.';
  end if;

  v_is_manager := mm_is_project_manager(v_exp.project_id);
  v_is_source  := v_exp.source_provider_id = auth.uid();
  v_link := '/projects/' || v_exp.project_id || '/transactions/' || v_exp.id;

  -- Authorization: the money provider verifies source-based spending;
  -- project managers verify manager-verified types. Never the submitter.
  if not (v_is_source or v_is_manager) then
    raise exception 'You are not authorized to verify this transaction.';
  end if;
  if v_exp.created_by = auth.uid() then
    raise exception 'You cannot verify a transaction you submitted yourself.';
  end if;
  if p_action = 'verified' and v_exp.funding_source = 'advance' and not v_is_source and not mm_is_system_admin() then
    -- managers may act only as a fallback when the source provider is external
    if v_exp.source_provider_id is not null then
      raise exception 'This purchase must be verified by the person who provided the money.';
    end if;
  end if;

  if p_action = 'verified' then
    update expenses
      set status = 'verified', verified_by = auth.uid(), verified_at = now()
      where id = v_exp.id
      returning * into v_exp;

    -- ledger cash movements (only now is the money counted as confirmed)
    if v_exp.funding_source = 'advance' then
      insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
        description, ref_type, ref_id, actor_id, entry_date)
      values (v_exp.project_id, 'advance_spend', 'custody', -v_exp.amount_poisha,
        'Verified purchase: ' || v_exp.title, 'expense', v_exp.id, auth.uid(), v_exp.purchased_on);
    elsif v_exp.funding_source = 'project_cash' then
      insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
        description, ref_type, ref_id, actor_id, entry_date)
      values (v_exp.project_id, 'expense_project_cash', 'main', -v_exp.amount_poisha,
        'Verified purchase: ' || v_exp.title, 'expense', v_exp.id, auth.uid(), v_exp.purchased_on);
    end if;

    -- Scenario B: personal money -> recognize the reimbursement payable now
    if v_exp.funding_source = 'personal' then
      insert into reimbursements (project_id, expense_id, payee_id, amount_poisha, outstanding_poisha)
      values (v_exp.project_id, v_exp.id, v_exp.paid_by, v_exp.amount_poisha, v_exp.amount_poisha)
      on conflict (expense_id) do nothing;
      perform mm_notify(v_exp.paid_by, 'reimbursement_created',
        'Claim verified — the project owes you ' || mm_fmt_money(v_exp.amount_poisha),
        'Your claim "' || v_exp.title || '" was verified. Settlement will be recorded separately.',
        v_link, v_exp.project_id);
    end if;

    v_notifier := v_exp.created_by;
    perform mm_notify(v_notifier, 'verification_completed',
      'Purchase verified: ' || mm_fmt_money(v_exp.amount_poisha),
      v_exp.title || ' was verified.', v_link, v_exp.project_id);

  elsif p_action = 'rejected' then
    update expenses
      set status = 'rejected', verified_by = auth.uid(), verified_at = now(), notes =
        case when coalesce(p_comment,'') <> '' then coalesce(v_exp.notes,'') || ' | Rejected: ' || p_comment
             else v_exp.notes end
      where id = v_exp.id
      returning * into v_exp;
    perform mm_notify(v_exp.created_by, 'verification_rejected',
      'Transaction rejected: ' || mm_fmt_money(v_exp.amount_poisha),
      coalesce(p_comment, 'No reason given.'), v_link, v_exp.project_id);
  else -- clarification
    update expenses set status = 'clarification' where id = v_exp.id returning * into v_exp;
    perform mm_notify(v_exp.created_by, 'clarification_requested',
      'Clarification needed: ' || mm_fmt_money(v_exp.amount_poisha),
      coalesce(p_comment, 'The verifier needs more information.'), v_link, v_exp.project_id);
  end if;

  insert into verification_events (transaction_type, transaction_id, verifier_id, verifier_name, action,
    previous_status, new_status, comment)
  values ('expense', v_exp.id, auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Unknown'), p_action,
    (case when p_action = 'verified' then 'pending' else v_exp.status end)::text, p_action::text, p_comment);

  perform mm_audit('expense.' || p_action::text, 'expense', v_exp.id,
    jsonb_build_object('amount', v_exp.amount_poisha, 'comment', p_comment));

  return v_exp;
end $$;

-- ================================================================
-- RPC: REIMBURSEMENT SETTLEMENT
-- ================================================================

create or replace function mm_settle_reimbursement(
  p_reimbursement uuid,
  p_amount_poisha bigint,
  p_paid_on date,
  p_method text default 'cash',
  p_reference text default null,
  p_notes text default null
) returns reimbursements
language plpgsql security definer set search_path = public as $$
declare
  v_rb reimbursements;
  v_new_outstanding bigint;
begin
  if p_amount_poisha is null or p_amount_poisha <= 0 then
    raise exception 'Enter a payment amount greater than zero.';
  end if;

  select * into v_rb from reimbursements where id = p_reimbursement for update;
  if not found then raise exception 'Reimbursement not found.'; end if;
  if not mm_is_project_manager(v_rb.project_id) then
    raise exception 'Only a project manager can record reimbursements.';
  end if;
  if v_rb.status = 'fully_reimbursed' or v_rb.outstanding_poisha <= 0 then
    raise exception 'This claim is already fully settled.';
  end if;
  if p_amount_poisha > v_rb.outstanding_poisha then
    raise exception using message =
      format('Payment exceeds the outstanding amount. Only %s remains.',
             mm_fmt_money(v_rb.outstanding_poisha));
  end if;

  insert into reimbursement_payments (reimbursement_id, amount_poisha, paid_on, method, reference, notes, recorded_by)
  values (p_reimbursement, p_amount_poisha, coalesce(p_paid_on, current_date), p_method, p_reference, p_notes, auth.uid());

  v_new_outstanding := v_rb.outstanding_poisha - p_amount_poisha;
  update reimbursements
    set outstanding_poisha = v_new_outstanding,
        status = case when v_new_outstanding = 0 then 'fully_reimbursed' else 'partially_reimbursed' end
    where id = p_reimbursement
    returning * into v_rb;

  -- cash movement: project pays the member
  insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
    description, ref_type, ref_id, actor_id, entry_date)
  values (v_rb.project_id, 'reimbursement_payment', 'main', -p_amount_poisha,
    'Reimbursement paid to ' || (select full_name from profiles where id = v_rb.payee_id),
    'reimbursement_payment', v_rb.id, auth.uid(), coalesce(p_paid_on, current_date));

  perform mm_notify(v_rb.payee_id, 'reimbursement_paid',
    case when v_rb.status = 'fully_reimbursed'
         then 'Reimbursed in full: ' || mm_fmt_money(p_amount_poisha)
         else 'Partial reimbursement: ' || mm_fmt_money(p_amount_poisha) end,
    case when v_rb.status = 'fully_reimbursed'
         then 'Your claim has been fully settled. Thank you!'
         else 'Remaining payable: ' || mm_fmt_money(v_rb.outstanding_poisha) end,
    '/projects/' || v_rb.project_id || '/reimbursements', v_rb.project_id);

  perform mm_audit('reimbursement.paid', 'reimbursement', v_rb.id,
    jsonb_build_object('amount', p_amount_poisha, 'method', p_method));

  return v_rb;
end $$;

-- ================================================================
-- RPC: CONTRIBUTIONS
-- ================================================================

create or replace function mm_verify_contribution(
  p_contribution uuid, p_action verification_action, p_comment text default null
) returns contributions
language plpgsql security definer set search_path = public as $$
declare
  v_c contributions;
  v_is_manager boolean;
begin
  select * into v_c from contributions where id = p_contribution for update;
  if not found then raise exception 'Contribution not found.'; end if;
  if v_c.status <> 'pending' then raise exception 'This contribution was already processed.'; end if;

  v_is_manager := mm_is_project_manager(v_c.project_id);
  -- The contributor (source of the money/asset) or a manager may verify.
  -- A member who merely recorded it on someone's behalf cannot.
  if not (v_is_manager or v_c.contributor_user_id = auth.uid()) then
    raise exception 'Only the contributor or a project manager can verify this contribution.';
  end if;
  if v_c.recorded_by = auth.uid() and v_c.contributor_user_id is distinct from auth.uid() then
    raise exception 'You cannot verify a contribution you recorded for someone else.';
  end if;

  if p_action = 'verified' then
    update contributions
      set status = 'verified', verified_by = auth.uid(), verified_at = now()
      where id = v_c.id returning * into v_c;

    if v_c.contribution_type = 'cash' then
      insert into financial_ledger_entries (project_id, entry_kind, bucket, amount_poisha,
        description, ref_type, ref_id, actor_id, entry_date)
      values (v_c.project_id, 'cash_contribution', 'main', v_c.amount_poisha,
        'Cash contribution from ' || v_c.contributor_name, 'contribution', v_c.id, auth.uid(), v_c.received_on);
    end if;
  elsif p_action = 'rejected' then
    update contributions
      set status = 'rejected', verified_by = auth.uid(), verified_at = now()
      where id = v_c.id returning * into v_c;
  else
    raise exception 'Use reject instead for contributions.';
  end if;

  insert into verification_events (transaction_type, transaction_id, verifier_id, verifier_name, action,
    previous_status, new_status, comment)
  values ('contribution', v_c.id, auth.uid(),
    coalesce((select full_name from profiles where id = auth.uid()), 'Unknown'), p_action, 'pending', p_action::text, p_comment);

  perform mm_notify(v_c.recorded_by, 'verification_completed',
    'Contribution ' || p_action::text || ': ' || v_c.title,
    coalesce(p_comment,''), '/projects/' || v_c.project_id || '/contributions', v_c.project_id);

  perform mm_audit('contribution.' || p_action::text, 'contribution', v_c.id, null);
  return v_c;
end $$;

create or replace function mm_set_allocations(
  p_contribution uuid,
  p_allocations jsonb  -- [{ "category": "equipment", "amount_poisha": 30000000, "note": null }]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_c contributions;
  v_total bigint := 0;
  v_alloc jsonb;
begin
  select * into v_c from contributions where id = p_contribution;
  if not found then raise exception 'Contribution not found.'; end if;
  if not mm_is_project_manager(v_c.project_id) then
    raise exception 'Only a project manager can set fund allocations.';
  end if;
  if v_c.contribution_type <> 'cash' then
    raise exception 'Spending allocations apply to cash contributions only.';
  end if;

  delete from contribution_allocations where contribution_id = p_contribution;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    if coalesce((v_alloc->>'amount_poisha')::bigint, 0) <= 0 then
      raise exception 'Allocation amounts must be greater than zero.';
    end if;
    v_total := v_total + (v_alloc->>'amount_poisha')::bigint;
    insert into contribution_allocations (contribution_id, category, amount_poisha, note, created_by)
    values (p_contribution, v_alloc->>'category', (v_alloc->>'amount_poisha')::bigint,
            v_alloc->>'note', auth.uid());
  end loop;

  if v_c.restricted and v_total = 0 then
    raise exception 'A restricted contribution needs at least one spending allocation.';
  end if;
  if v_total > v_c.amount_poisha then
    raise exception using message =
      format('Allocations total %s but the contribution is only %s.',
             mm_fmt_money(v_total), mm_fmt_money(v_c.amount_poisha));
  end if;

  perform mm_audit('contribution.allocations', 'contribution', p_contribution,
    jsonb_build_object('total', v_total));
end $$;

-- ================================================================
-- RPC: MEMBERSHIP & INVITES
-- ================================================================

create or replace function mm_invite_member(p_project uuid, p_email text, p_role member_role default 'member')
returns project_invitations
language plpgsql security definer set search_path = public as $$
declare v_inv project_invitations;
begin
  if not mm_is_project_manager(p_project) then
    raise exception 'Only a project manager can invite members.';
  end if;
  insert into project_invitations (project_id, email, role, invited_by)
  values (p_project, lower(trim(p_email)), p_role, auth.uid())
  on conflict (project_id, email) do update
    set role = excluded.role, status = 'pending', expires_at = now() + interval '7 days'
  returning * into v_inv;
  return v_inv;
end $$;

create or replace function mm_join_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_project projects%rowtype;
begin
  select * into v_project from projects where invite_code = lower(trim(p_code));
  if not found then raise exception 'Invalid invite code.'; end if;
  if v_project.status in ('archived') then raise exception 'This project is archived.'; end if;

  insert into project_members (project_id, user_id, role)
  values (v_project.id, auth.uid(), 'member')
  on conflict (project_id, user_id) do nothing;

  -- notify managers that a member joined
  perform mm_notify(v_project.owner_id, 'member_joined',
    (select full_name from profiles where id = auth.uid()) || ' joined ' || v_project.name,
    null, '/projects/' || v_project.id || '/members', v_project.id);

  return v_project.id;
end $$;

create or replace function mm_accept_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv project_invitations%rowtype;
begin
  select * into v_inv from project_invitations where id = p_invitation for update;
  if not found then raise exception 'Invitation not found.'; end if;
  if v_inv.email <> (select email from auth.users where id = auth.uid()) then
    raise exception 'This invitation was sent to a different email address.';
  end if;
  if v_inv.status <> 'pending' then raise exception 'This invitation is no longer active.'; end if;
  if v_inv.expires_at < now() then raise exception 'This invitation has expired.'; end if;

  insert into project_members (project_id, user_id, role) values (v_inv.project_id, auth.uid(), v_inv.role)
  on conflict (project_id, user_id) do nothing;

  update project_invitations set status = 'accepted' where id = p_invitation;
  return v_inv.project_id;
end $$;

-- ================================================================
-- RPC: RESOURCES (with movement history)
-- ================================================================

create or replace function mm_update_resource(
  p_resource uuid,
  p_status resource_status,
  p_custodian uuid default null,
  p_location text default null,
  p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_r project_resources%rowtype;
begin
  select * into v_r from project_resources where id = p_resource;
  if not found then raise exception 'Resource not found.'; end if;
  if not (mm_is_project_manager(v_r.project_id) or v_r.created_by = auth.uid() or v_r.custodian_id = auth.uid()) then
    raise exception 'You are not authorized to update this resource.';
  end if;

  update project_resources
    set status = p_status, custodian_id = coalesce(p_custodian, custodian_id),
        location = coalesce(p_location, location)
    where id = p_resource;

  insert into resource_movements (resource_id, status_to, custodian_id, custodian_name, location, note, recorded_by)
  values (p_resource, p_status, p_custodian,
          case when p_custodian is null then null else (select full_name from profiles where id = p_custodian) end,
          p_location, p_note, auth.uid());

  if p_custodian is not null and p_custodian <> v_r.custodian_id then
    perform mm_notify(p_custodian, 'resource_assigned',
      'Resource assigned to you: ' || v_r.name,
      coalesce(p_note,''), '/projects/' || v_r.project_id || '/resources', v_r.project_id);
  end if;
  if p_status = 'returned' and v_r.owner_user_id is not null then
    perform mm_notify(v_r.owner_user_id, 'resource_returned',
      'Resource returned: ' || v_r.name, coalesce(p_note,''),
      '/projects/' || v_r.project_id || '/resources', v_r.project_id);
  end if;
end $$;

-- ================================================================
-- RPC: PROJECT FINANCIAL SUMMARY
-- ================================================================

create or replace function mm_project_summary(p_project uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_cash_in_verified bigint;
  v_cash_in_pending bigint;
  v_adv_own bigint;
  v_adv_spent_verified bigint;
  v_adv_spent_pending bigint;
  v_exp_prj_verified bigint;
  v_exp_prj_pending bigint;
  v_exp_adv_pending bigint;
  v_personal_pending bigint;
  v_rb_outstanding bigint;
  v_rb_paid bigint;
  v_noncash_verified bigint;
  v_noncash_pending bigint;
  v_expenses_verified bigint;
  v_available bigint;
  v_pending_delta bigint;
begin
  select coalesce(sum(amount_poisha),0) into v_cash_in_verified
    from contributions where project_id = p_project and contribution_type='cash' and status='verified';
  select coalesce(sum(amount_poisha),0) into v_cash_in_pending
    from contributions where project_id = p_project and contribution_type='cash' and status='pending';

  select coalesce(sum(amount_poisha),0) into v_adv_own
    from advances where project_id = p_project and status='active' and funding_source='own_funds';

  select coalesce(sum(e.amount_poisha),0) into v_adv_spent_verified
    from expenses e join advances a on a.id = e.advance_id
    where e.project_id = p_project and e.status='verified' and e.funding_source='advance';
  select coalesce(sum(e.amount_poisha),0) into v_exp_adv_pending
    from expenses e where e.project_id = p_project and e.funding_source='advance' and e.status in ('pending','clarification');

  select coalesce(sum(amount_poisha),0) into v_exp_prj_verified
    from expenses where project_id = p_project and funding_source='project_cash' and status='verified';
  select coalesce(sum(amount_poisha),0) into v_exp_prj_pending
    from expenses where project_id = p_project and funding_source='project_cash' and status in ('pending','clarification');
  select coalesce(sum(amount_poisha),0) into v_personal_pending
    from expenses where project_id = p_project and funding_source='personal' and status in ('pending','clarification');

  select coalesce(sum(amount_poisha),0) into v_rb_outstanding
    from reimbursements where project_id = p_project and status in ('outstanding','partially_reimbursed');
  select coalesce(sum(p.amount_poisha),0) into v_rb_paid
    from reimbursement_payments p join reimbursements r on r.id = p.reimbursement_id
    where r.project_id = p_project;

  select coalesce(sum(amount_poisha),0) into v_noncash_verified
    from contributions where project_id = p_project and contribution_type <> 'cash' and status='verified';
  select coalesce(sum(amount_poisha),0) into v_noncash_pending
    from contributions where project_id = p_project and contribution_type <> 'cash' and status='pending';

  select coalesce(sum(amount_poisha),0) into v_expenses_verified
    from expenses where project_id = p_project and status='verified';

  -- Confirmed cash position (money actually traceable in the project):
  v_available := v_cash_in_verified + v_adv_own - v_adv_spent_verified - v_exp_prj_verified - v_rb_paid;
  v_pending_delta := -(v_exp_adv_pending + v_exp_prj_pending);

  return jsonb_build_object(
    'cash_in_verified', v_cash_in_verified,
    'cash_in_pending', v_cash_in_pending,
    'own_funds_advances', v_adv_own,
    'advance_spent_verified', v_adv_spent_verified,
    'advance_spent_pending', v_exp_adv_pending,
    'project_cash_spent_verified', v_exp_prj_verified,
    'project_cash_spent_pending', v_exp_prj_pending,
    'personal_claims_pending', v_personal_pending,
    'reimbursements_outstanding', v_rb_outstanding,
    'reimbursements_paid', v_rb_paid,
    'expenses_verified', v_expenses_verified,
    'noncash_verified', v_noncash_verified,
    'noncash_pending', v_noncash_pending,
    'available_cash', v_available,
    'pending_cash_delta', v_pending_delta,
    'projected_cash', v_available + v_pending_delta,
    -- money physically held by custodians right now (incl. pending spends)
    'custodial_cash', (
      select coalesce(sum(a.amount_poisha - coalesce(agg.spent, 0)), 0)
      from advances a
      left join (
        select advance_id, sum(amount_poisha) as spent
        from expenses where status <> 'rejected' group by advance_id
      ) agg on agg.advance_id = a.id
      where a.project_id = p_project and a.status = 'active'
    )
  );
end $$;
