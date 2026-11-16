import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const CONTRIBUTION_SELECT = `
  id, project_id, contribution_type, contributor_user_id, contributor_name, title, description,
  amount_poisha, currency, restricted, received_on, ownership_status, usage_start, usage_end,
  usage_conditions, location, quantity, unit, status, recorded_by, verified_by, verified_at, created_at,
  contributor:profiles!contributions_contributor_user_id_fkey(id, full_name),
  recorder:profiles!contributions_recorded_by_fkey(id, full_name),
  allocations:contribution_allocations(id, category, amount_poisha, note, created_at)
`

export const contributionsApi = {
  async list(projectId, { type } = {}) {
    let query = supabase
      .from('contributions')
      .select(CONTRIBUTION_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (type) query = query.eq('contribution_type', type)
    return q(query)
  },

  async get(id) {
    return q(supabase.from('contributions').select(CONTRIBUTION_SELECT).eq('id', id).maybeSingle())
  },

  /** Create a contribution of any type. Returns the created row. */
  async create(payload, userId) {
    const amount = parseTakaToPoisha(payload.amount)
    if (amount === null) throw new Error('Enter a valid amount')
    const row = {
      project_id: payload.project_id,
      contribution_type: payload.contribution_type,
      contributor_user_id: payload.contributor_mode === 'self' ? userId : payload.contributor_user_id || null,
      contributor_name: payload.contributor_name.trim(),
      title: payload.title.trim(),
      description: payload.description || null,
      amount_poisha: amount,
      restricted: Boolean(payload.restricted) && payload.contribution_type === 'cash',
      received_on: payload.received_on,
      ownership_status: payload.ownership_status || 'undetermined',
      quantity: payload.quantity && Number(payload.quantity) > 0 ? Number(payload.quantity) : 1,
      unit: payload.unit || null,
      location: payload.location || null,
      usage_start: payload.contribution_type === 'in_kind' ? payload.usage_start : null,
      usage_end: payload.contribution_type === 'in_kind' ? payload.usage_end : null,
      usage_conditions: payload.usage_conditions || null,
      recorded_by: userId,
      status: 'pending',
    }
    const { data, error } = await supabase.from('contributions').insert(row).select(CONTRIBUTION_SELECT).single()
    if (error) throw error
    return data
  },

  async update(id, patch) {
    return q(supabase.from('contributions').update(patch).eq('id', id).select(CONTRIBUTION_SELECT).single())
  },

  async remove(id) {
    return q(supabase.from('contributions').delete().eq('id', id))
  },

  verify(id, action, comment) {
    return rpc('mm_verify_contribution', { p_contribution: id, p_action: action, p_comment: comment || null })
  },

  async setAllocations(contributionId, allocations) {
    return rpc('mm_set_allocations', {
      p_contribution: contributionId,
      p_allocations: allocations.map((a) => ({
        category: a.category,
        amount_poisha: parseTakaToPoisha(a.amount),
        note: a.note || null,
      })),
    })
  },

  async attachments(id) {
    return q(
      supabase.from('transaction_attachments').select('*').eq('transaction_type', 'contribution').eq('transaction_id', id).order('created_at'),
    )
  },
}

/** Allocations with live remaining balances (view, RLS enforced). */
export const allocationsApi = {
  async listByProject(projectId) {
    return q(
      supabase
        .from('allocations_with_balance')
        .select(`
          id, contribution_id, category, amount_poisha, note, remaining_poisha, spent_poisha,
          contribution_title, contributor_name
        `)
        .eq('project_id', projectId)
        .order('created_at'),
    )
  },

  async remainingForIds(ids) {
    if (!ids.length) return {}
    const rows = await q(supabase.from('allocations_with_balance').select('id, remaining_poisha, category, contribution_title').in('id', ids))
    return Object.fromEntries(rows.map((r) => [r.id, r]))
  },
}
