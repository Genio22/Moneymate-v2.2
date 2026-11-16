import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const REIMBURSEMENT_SELECT = `
  id, project_id, expense_id, payee_id, amount_poisha, outstanding_poisha, status, created_at,
  payee:profiles!reimbursements_payee_id_fkey(id, full_name),
  expense:expenses(id, title, reference, amount_poisha, category, purchased_on, status),
  payments:reimbursement_payments(id, amount_poisha, paid_on, method, reference, notes, created_at)
`

export const reimbursementsApi = {
  async list(projectId, { payee } = {}) {
    let query = supabase
      .from('reimbursements')
      .select(REIMBURSEMENT_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (payee) query = query.eq('payee_id', payee)
    return q(query)
  },

  async listMine(userId) {
    return q(
      supabase
        .from('reimbursements')
        .select(`${REIMBURSEMENT_SELECT}, project:projects(id, name)`)
        .eq('payee_id', userId)
        .neq('status', 'fully_reimbursed')
        .order('created_at', { ascending: false }),
    )
  },

  settle(payload, reimbursementId) {
    const amount = parseTakaToPoisha(payload.amount)
    if (amount === null) throw new Error('Enter a valid amount')
    return rpc('mm_settle_reimbursement', {
      p_reimbursement: reimbursementId,
      p_amount_poisha: amount,
      p_paid_on: payload.paid_on,
      p_method: payload.method,
      p_reference: payload.reference || null,
      p_notes: payload.notes || null,
    })
  },
}
