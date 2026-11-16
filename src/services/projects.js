import { supabase } from '../lib/supabase'
import { q, rpc } from './api'
import { parseTakaToPoisha } from '../utils/money'

const PROJECT_SELECT = `
  id, name, description, image_url, category, status, start_date, expected_end_date,
  initial_budget, currency, owner_id, invite_code, created_at,
  owner:profiles!projects_owner_id_fkey(id, full_name)
`

export const projectsApi = {
  /** All projects the signed-in user belongs to (RLS enforces this). */
  async listMy() {
    const memberships = await q(
      supabase.from('project_members').select('project_id, role').eq('user_id', (await supabase.auth.getUser()).data.user.id),
    )
    if (!memberships.length) return []
    const ids = memberships.map((m) => m.project_id)
    const projects = await q(
      supabase.from('projects').select(PROJECT_SELECT).in('id', ids).order('created_at', { ascending: false }),
    )
    const roleByProject = Object.fromEntries(memberships.map((m) => [m.project_id, m.role]))
    return projects.map((p) => ({ ...p, my_role: roleByProject[p.id] || 'member' }))
  },

  async get(projectId) {
    return q(supabase.from('projects').select(PROJECT_SELECT).eq('id', projectId).maybeSingle())
  },

  async create(payload) {
    const user = (await supabase.auth.getUser()).data.user
    const budget = payload.initial_budget ? parseTakaToPoisha(payload.initial_budget) : null
    if (payload.initial_budget && budget === null) throw new Error('Initial budget is not a valid amount')
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: payload.name.trim(),
        description: payload.description || null,
        category: payload.category,
        start_date: payload.start_date,
        expected_end_date: payload.expected_end_date || null,
        initial_budget: budget,
        status: payload.status || 'active',
        owner_id: user.id,
      })
      .select(PROJECT_SELECT)
      .single()
    if (error) throw error
    return project
  },

  async update(projectId, patch) {
    if (patch.initial_budget !== undefined) {
      patch.initial_budget = patch.initial_budget ? parseTakaToPoisha(patch.initial_budget) : null
      if (patch.initial_budget === null && patch.initial_budget_input) throw new Error('Initial budget is not a valid amount')
    }
    return q(supabase.from('projects').update(patch).eq('id', projectId).select(PROJECT_SELECT).single())
  },

  async summary(projectId) {
    return rpc('mm_project_summary', { p_project: projectId })
  },

  /** Financial summary for many projects (dashboard). */
  async summaryForMany(projectIds) {
    const results = await Promise.allSettled(projectIds.map((id) => rpc('mm_project_summary', { p_project: id })))
    return results.map((r, i) => ({ project_id: projectIds[i], summary: r.status === 'fulfilled' ? r.value : null }))
  },

  async members(projectId) {
    return q(
      supabase
        .from('project_members')
        .select('id, role, joined_at, user:profiles!project_members_user_id_fkey(id, full_name, phone, avatar_url)')
        .eq('project_id', projectId)
        .order('joined_at'),
    )
  },

  async setMemberRole(memberId, role) {
    return q(supabase.from('project_members').update({ role }).eq('id', memberId).select().single())
  },

  async removeMember(memberId) {
    return q(supabase.from('project_members').delete().eq('id', memberId))
  },

  async inviteMember(projectId, email, role) {
    return rpc('mm_invite_member', { p_project: projectId, p_email: email, p_role: role })
  },

  async listInvitations(projectId) {
    return q(supabase.from('project_invitations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }))
  },

  async revokeInvitation(invitationId) {
    return q(supabase.from('project_invitations').update({ status: 'revoked' }).eq('id', invitationId))
  },

  async joinByCode(code) {
    return rpc('mm_join_by_code', { p_code: code })
  },

  async myPendingInvitations() {
    const user = (await supabase.auth.getUser()).data.user
    return q(
      supabase
        .from('project_invitations')
        .select('id, role, status, expires_at, project:projects!project_invitations_project_id_fkey(id, name, category, status)')
        .eq('email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()),
    )
  },

  async acceptInvitation(invitationId) {
    return rpc('mm_accept_invitation', { p_invitation: invitationId })
  },
}
