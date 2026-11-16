import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const RESOURCE_SELECT = `
  id, project_id, name, resource_type, description, source_contribution_id, owner_user_id, owner_name,
  ownership_status, quantity, unit, agreed_value_poisha, custodian_id, location, status, returnable,
  usage_start, usage_end, usage_conditions, notes, created_by, created_at,
  owner:profiles!project_resources_owner_user_id_fkey(id, full_name),
  custodian:profiles!project_resources_custodian_id_fkey(id, full_name)
`

export const resourcesApi = {
  async list(projectId, { status, type } = {}) {
    let query = supabase
      .from('project_resources')
      .select(RESOURCE_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (type) query = query.eq('resource_type', type)
    return q(query)
  },

  async get(id) {
    return q(supabase.from('project_resources').select(RESOURCE_SELECT).eq('id', id).maybeSingle())
  },

  async create(payload, projectId, userId) {
    const value = payload.agreed_value ? parseTakaToPoisha(payload.agreed_value) : null
    let ownerName = null
    let ownerId = null
    if (payload.owner_mode === 'external') {
      ownerName = (payload.owner_name || '').trim()
    } else if (payload.owner_mode === 'self') {
      ownerId = userId
      ownerName = payload.owner_display_name || null
    } else {
      ownerId = payload.owner_user_id || null
      ownerName = payload.owner_display_name || null
    }
    if (!ownerName) throw new Error('Choose the owner of this resource')
    const row = {
      project_id: projectId,
      name: payload.name.trim(),
      resource_type: payload.resource_type,
      description: payload.description || null,
      source_contribution_id: payload.source_contribution_id || null,
      owner_user_id: ownerId,
      owner_name: ownerName,
      ownership_status: payload.ownership_status,
      quantity: payload.quantity && Number(payload.quantity) > 0 ? Number(payload.quantity) : 1,
      unit: payload.unit || null,
      agreed_value_poisha: value,
      custodian_id: payload.custodian_id || null,
      location: payload.location || null,
      status: payload.status,
      returnable: payload.returnable,
      usage_start: payload.usage_start || null,
      usage_end: payload.usage_end || null,
      usage_conditions: payload.usage_conditions || null,
      notes: payload.notes || null,
      created_by: userId,
    }
    const { data, error } = await supabase.from('project_resources').insert(row).select(RESOURCE_SELECT).single()
    if (error) throw error
    return data
  },

  async setStatus(resourceId, status, custodianId, location, note) {
    return rpc('mm_update_resource', {
      p_resource: resourceId,
      p_status: status,
      p_custodian: custodianId || null,
      p_location: location || null,
      p_note: note || null,
    })
  },

  async movements(resourceId) {
    return q(
      supabase
        .from('resource_movements')
        .select('id, status_to, custodian_name, location, note, created_at')
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false }),
    )
  },
}
