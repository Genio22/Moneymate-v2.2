import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const ADVANCE_SELECT = `
  id, project_id, reference, provider_user_id, provider_name, custodian_id, amount_poisha,
  funding_source, purpose, provided_on, status, custodian_confirmed_at, created_by, created_at,
  remaining_poisha, reconciled_poisha, pending_poisha,
  custodian:profiles!advances_custodian_id_fkey(id, full_name),
  provider_user:profiles!advances_provider_user_id_fkey(id, full_name)
`

export const advancesApi = {
  /** Uses the advances_with_balance view so remaining/reconciled/pending come from the DB. */
  async list(projectId, { custodian } = {}) {
    let query = supabase
      .from('advances_with_balance')
      .select(ADVANCE_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (custodian) query = query.eq('custodian_id', custodian)
    return q(query)
  },

  async get(id) {
    return q(supabase.from('advances_with_balance').select(ADVANCE_SELECT).eq('id', id).maybeSingle())
  },

  async create(payload, projectId) {
    const amount = parseTakaToPoisha(payload.amount)
    if (amount === null) throw new Error('Enter a valid amount')
    return rpc('mm_create_advance', {
      p_project: projectId,
      p_provider: payload.provider_mode === 'external' ? null : payload.provider_user_id || null,
      p_provider_name: payload.provider_mode === 'external' ? payload.provider_name : null,
      p_custodian: payload.custodian_id,
      p_amount_poisha: amount,
      p_funding_source: payload.funding_source,
      p_purpose: payload.purpose || null,
      p_provided_on: payload.provided_on,
    })
  },

  confirm(id) {
    return rpc('mm_confirm_advance', { p_advance: id })
  },

  /** Expenses recorded against each advance (for the reconciliation card). */
  async expensesFor(advanceId) {
    return q(
      supabase
        .from('expenses')
        .select(`
          id, reference, title, amount_poisha, status, purchased_on, category,
          paid_by_user:profiles!expenses_paid_by_fkey(id, full_name)
        `)
        .eq('advance_id', advanceId)
        .order('purchased_on', { ascending: false }),
    )
  },
}
