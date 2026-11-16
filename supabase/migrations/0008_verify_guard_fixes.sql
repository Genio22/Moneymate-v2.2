-- =====================================================================
-- MoneyMate 0008 — Verification guard fixes
-- 1) mm_verify_expense: the submitter check now comes FIRST, so a member
--    who tries to verify their own expense gets the specific message
--    instead of a generic authorization error.
-- 2) mm_verify_contribution: a manager who recorded a contribution on
--    behalf of an external contributor (no user account) may verify it.
--    Without this, single-manager projects could never verify restricted
--    sponsor contributions. Non-manager recorders remain blocked.
-- =====================================================================

create or replace function public.mm_verify_expense(p_expense uuid, p_action verification_action, p_comment text default null)
returns expenses
language plpgsql
security definer
set search_path = public
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
    if v_exp.source_provider_id is not null then
      raise exception 'This purchase must be verified by the person who provided the money.';
    end if;
  end if;

  if p_action = 'verified' then
    update expenses
      set status = 'verified', verified_by = auth.uid(), verified_at = now()
      where id = v_exp.id
      returning * into v_exp;

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

create or replace function public.mm_verify_contribution(p_contribution uuid, p_action verification_action, p_comment text default null)
returns contributions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c contributions;
  v_is_manager boolean;
begin
  select * into v_c from contributions where id = p_contribution for update;
  if not found then raise exception 'Contribution not found.'; end if;
  if v_c.status <> 'pending' then raise exception 'This contribution was already processed.'; end if;

  v_is_manager := mm_is_project_manager(v_c.project_id);

  -- The contributor (source of the money/asset) or a manager may verify.
  if not (v_is_manager or v_c.contributor_user_id = auth.uid()) then
    raise exception 'Only the contributor or a project manager can verify this contribution.';
  end if;

  -- A non-manager who recorded a contribution for someone else cannot verify
  -- it. A MANAGER may (otherwise an external sponsor's contribution could
  -- never be verified in a single-manager project).
  if v_c.recorded_by = auth.uid() and v_c.contributor_user_id is distinct from auth.uid() and not v_is_manager then
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
