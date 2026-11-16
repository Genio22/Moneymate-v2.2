-- 0009_fix_settlement_enum_cast.sql
--
-- Bug fix: mm_settle_reimbursement assigned the reimbursement status inside a CASE
-- that produced a bare text literal. In Postgres, `case when ... then 'fully_reimbursed'
-- else 'partially_reimbursed' end` is of type text and cannot be assigned directly to a
-- reimbursement_status column without an explicit cast (unlike a plain literal in a SET,
-- which Postgres coerces automatically). The function failed at update time with
-- `column "status" is of type reimbursement_status but expression is of type text`.
--
-- Fix: cast the CASE result to reimbursement_status.

create or replace function public.mm_settle_reimbursement(
  p_reimbursement uuid,
  p_amount_poisha bigint,
  p_paid_on date,
  p_method text default 'cash'::text,
  p_reference text default null::text,
  p_notes text default null::text
)
returns reimbursements
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        status = (case when v_new_outstanding = 0 then 'fully_reimbursed' else 'partially_reimbursed' end)::reimbursement_status
    where id = p_reimbursement
    returning * into v_rb;

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
end $function$;
