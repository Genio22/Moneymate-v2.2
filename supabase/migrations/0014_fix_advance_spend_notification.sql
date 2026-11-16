-- 0014: Fix expense submission crash when an advance has no third-party provider.
--
-- Spending from an advance whose provider is NULL (advance funded from project
-- cash / an external person recorded by name) made mm_expense_notify insert a
-- notification with user_id = NULL, violating the not-null constraint and
-- rolling back the whole expense INSERT:
--   "Null value in column "user_id" of relation "notifications" ..."
--
-- Fix:
--   1. mm_expense_notify: only ask the provider to verify when the provider is
--      a third party (NOT NULL and different from the submitter). Otherwise
--      fall back to the manager-notification path — mm_verify_expense already
--      lets managers verify when source_provider_id IS NULL.
--   2. mm_verify_expense: when the provider equals the submitter (dead end:
--      the provider can't self-verify, managers were blocked), treat it like a
--      NULL provider so managers can verify.

create or replace function mm_expense_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mgr record;
  v_link text;
  v_title text;
begin
  v_link := '/projects/' || new.project_id || '/verification';
  v_title := mm_fmt_money(new.amount_poisha) || ' — ' || new.title;

  if TG_OP = 'INSERT' then
    if new.funding_source = 'advance'
       and new.source_provider_id is not null
       and new.source_provider_id <> new.created_by then
      -- Scenario A: money provided by another person -> source verification
      perform mm_notify(
        new.source_provider_id, 'verification_requested',
        'Verify a purchase paid with money you provided',
        coalesce((select full_name from profiles where id = new.created_by), 'A member')
          || ' spent ' || v_title || ' using the advance you provided.',
        v_link, new.project_id);
    else
      -- Scenario B: personal money, or an advance without a third-party
      -- provider (project-cash-funded / provider is the submitter) -> managers
      for v_mgr in
        select pm.user_id from project_members pm
        where pm.project_id = new.project_id and pm.role = 'manager'
      loop
        if v_mgr.user_id <> new.created_by then
          perform mm_notify(
            v_mgr.user_id, 'verification_requested',
            case when new.funding_source = 'personal'
                 then 'Reimbursement claim needs verification'
                 else 'Purchase needs manager verification' end,
            coalesce((select full_name from profiles where id = new.created_by), 'A member')
              || case when new.funding_source = 'personal'
                      then ' claims ' || v_title || ' spent from personal funds.'
                      else ' spent ' || v_title || '.' end,
            v_link, new.project_id);
        end if;
      end loop;
    end if;
  elsif TG_OP = 'UPDATE' and new.status = 'pending' and old.status = 'clarification' then
    -- member responded to a clarification request: ask verifier again
    if new.funding_source = 'advance'
       and new.source_provider_id is not null
       and new.source_provider_id <> new.created_by then
      perform mm_notify(new.source_provider_id, 'verification_requested',
        'Updated purchase needs your verification', v_title, v_link, new.project_id);
    else
      for v_mgr in
        select pm.user_id from project_members pm
        where pm.project_id = new.project_id and pm.role = 'manager'
      loop
        if v_mgr.user_id <> new.created_by then
          perform mm_notify(v_mgr.user_id, 'verification_requested',
            'Updated transaction needs verification', v_title, v_link, new.project_id);
        end if;
      end loop;
    end if;
  end if;
  return new;
end $$;

create or replace function mm_verify_expense(
  p_expense uuid, p_action verification_action, p_comment text default null
) returns expenses
language plpgsql security definer set search_path = public
as $$
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

  -- Never the submitter (checked first so the message is specific).
  if v_exp.created_by = auth.uid() then
    raise exception 'You cannot verify a transaction you submitted yourself.';
  end if;

  -- Authorization: the money provider verifies source-based spending;
  -- project managers verify manager-verified types.
  if not (v_is_source or v_is_manager) then
    raise exception 'You are not authorized to verify this transaction.';
  end if;

  if p_action = 'verified' and v_exp.funding_source = 'advance' and not v_is_source and not mm_is_system_admin() then
    -- managers may act only as a fallback when the source provider is external
    -- (a NULL provider means the advance was project-cash funded; a provider
    --  equal to the submitter would be a dead end — both fall back to managers)
    if v_exp.source_provider_id is not null and v_exp.source_provider_id <> v_exp.created_by then
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
  else
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
