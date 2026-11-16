import { supabase } from '../lib/supabase'
import { q } from './api'

/**
 * DB notification links are app-relative project paths ("/projects/<id>/…"),
 * but every route lives under "/app". Older rows (and any writer that emits
 * bare paths) would navigate to a 404, so prefix "/app" defensively.
 */
export function normalizeNotificationLink(link) {
  if (typeof link !== 'string' || !link) return link
  if (/^https?:\/\//i.test(link)) return link
  if (link.startsWith('/app')) return link
  return `/app${link.startsWith('/') ? '' : '/'}${link}`
}

export const notificationsApi = {
  async list(userId, { unreadOnly = false, limit = 50 } = {}) {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (unreadOnly) query = query.eq('read', false)
    return q(query)
  },

  async unreadCount(userId) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (error) throw error
    return count || 0
  },

  async markRead(id) {
    return q(supabase.from('notifications').update({ read: true }).eq('id', id))
  },

  async markAllRead(userId) {
    return q(supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false))
  },

  /** Live updates for the bell + badge. */
  subscribe(userId, onChange) {
    // supabase.channel() returns the ALREADY-SUBSCRIBED channel when called
    // twice with the same topic, and attaching postgres_changes callbacks to
    // a subscribed channel throws ("cannot add ... after subscribe()").
    // Two components subscribe for the same user (AppShell bell +
    // NotificationsPage), so every call needs its own uniquely-named channel.
    // The returned cleanup removes it, so churn is bounded.
    const channel = supabase
      .channel(`notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        onChange,
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}
