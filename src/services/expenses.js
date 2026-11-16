import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const EXPENSE_SELECT = `
  id, project_id, reference, title, description, amount_poisha, category, vendor, quantity, unit,
  purchased_on, funding_source, advance_id, contribution_allocation_id, restriction_exception,
  status, source_provider_id, verification_type, notes, created_by, verified_by, verified_at,
  created_at, updated_at,
  paid_by_user:profiles!expenses_paid_by_fkey(id, full_name),
  source_provider:profiles!expenses_source_provider_id_fkey(id, full_name),
  verifier:profiles!expenses_verified_by_fkey(id, full_name),
  recorder:profiles!expenses_created_by_fkey(id, full_name),
  advance:advances(id, reference, provider_user_id, provider_name, amount_poisha, funding_source),
  allocation:contribution_allocations(id, category, amount_poisha)
`

export const expensesApi = {
  async list(projectId, filters = {}) {
    let query = supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.funding_source) query = query.eq('funding_source', filters.funding_source)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.paid_by) query = query.eq('paid_by', filters.paid_by)
    if (filters.from) query = query.gte('purchased_on', filters.from)
    if (filters.to) query = query.lte('purchased_on', filters.to)
    if (filters.search) query = query.or(`title.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`)
    return q(query)
  },

  async listAcrossProjects(filters = {}) {
    let query = supabase
      .from('expenses')
      .select(`${EXPENSE_SELECT}, project:projects(id, name)`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (filters.paid_by) query = query.eq('paid_by', filters.paid_by)
    return q(query)
  },

  async get(id) {
    return q(supabase.from('expenses').select(`${EXPENSE_SELECT}, project:projects(id, name)`).eq('id', id).maybeSingle())
  },

  /** Create the expense row (triggers validate advance balance + restrictions). */
  async create(payload) {
    const amount = parseTakaToPoisha(payload.amount)
    if (amount === null) throw new Error('Enter a valid amount')
    const row = {
      project_id: payload.project_id,
      title: payload.title.trim(),
      amount_poisha: amount,
      purchased_on: payload.purchased_on,
      category: payload.category,
      funding_source: payload.funding_source,
      advance_id: payload.funding_source === 'advance' ? payload.advance_id : null,
      contribution_allocation_id: payload.funding_source === 'advance' || payload.funding_source === 'project_cash' ? payload.allocation_id || null : null,
      vendor: payload.vendor || null,
      notes: payload.notes || null,
      paid_by: payload.paid_by,
      created_by: payload.created_by,
      status: 'pending',
      verification_type: payload.funding_source === 'advance' ? 'source' : 'manager',
    }
    const { data, error } = await supabase.from('expenses').insert(row).select(EXPENSE_SELECT).single()
    if (error) throw error
    return data
  },

  async update(id, payload) {
    const amount = parseTakaToPoisha(payload.amount)
    if (amount === null) throw new Error('Enter a valid amount')
    const patch = {
      title: payload.title.trim(),
      amount_poisha: amount,
      purchased_on: payload.purchased_on,
      category: payload.category,
      vendor: payload.vendor || null,
      notes: payload.notes || null,
      advance_id: payload.funding_source === 'advance' ? payload.advance_id : null,
      funding_source: payload.funding_source,
      status: 'pending',
    }
    const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select(EXPENSE_SELECT).single()
    if (error) throw error
    return data
  },

  verify(id, action, comment) {
    return rpc('mm_verify_expense', { p_expense: id, p_action: action, p_comment: comment || null })
  },

  async attachments(id) {
    return q(
      supabase.from('transaction_attachments').select('*').eq('transaction_type', 'expense').eq('transaction_id', id).order('created_at'),
    )
  },

  /** Pending items I am allowed to verify in this project. */
  async myPendingVerifications(projectId, userId) {
    return q(
      supabase
        .from('expenses')
        .select(EXPENSE_SELECT)
        .eq('project_id', projectId)
        .in('status', ['pending', 'clarification'])
        .neq('created_by', userId)
        .order('created_at', { ascending: true }),
    )
  },

  async pendingCountAcrossProjects(userId) {
    const { count, error } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'clarification'])
      .neq('created_by', userId)
    if (error) throw error
    return count || 0
  },
}

export const verificationApi = {
  async events(txType, txId) {
    return q(
      supabase
        .from('verification_events')
        .select('id, action, previous_status, new_status, comment, created_at, verifier_name, verifier:profiles!verification_events_verifier_id_fkey(id, full_name)')
        .eq('transaction_type', txType)
        .eq('transaction_id', txId)
        .order('created_at', { ascending: false }),
    )
  },
}
