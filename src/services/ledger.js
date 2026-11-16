import { supabase } from '../lib/supabase'
import { q } from './api'

const LEDGER_SELECT = `
  id, project_id, entry_kind, bucket, amount_poisha, description, ref_type, ref_id, entry_date, created_at,
  actor:profiles!financial_ledger_entries_actor_id_fkey(id, full_name)
`

export const ledgerApi = {
  async list(projectId, { from, to, kind } = {}) {
    let query = supabase
      .from('financial_ledger_entries')
      .select(LEDGER_SELECT)
      .eq('project_id', projectId)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1000)
    if (from) query = query.gte('entry_date', from)
    if (to) query = query.lte('entry_date', to)
    if (kind) query = query.eq('entry_kind', kind)
    return q(query)
  },
}
