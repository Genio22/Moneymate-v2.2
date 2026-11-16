import { supabase } from '../lib/supabase'
import { q } from './api'

export const authApi = {
  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return data
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    if (error) throw error
  },

  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  },

  async getProfile(userId) {
    return q(supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
  },

  async updateProfile(userId, patch) {
    return q(supabase.from('profiles').update(patch).eq('id', userId).select().single())
  },
}
