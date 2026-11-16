import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { authApi } from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    try {
      const p = await authApi.getProfile(userId)
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setInitialized(true)
      return
    }
    let mounted = true
    authApi.getSession().then(async (s) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) await loadProfile(s.user.id)
      setLoading(false)
      setInitialized(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s?.user) await loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => {
      mounted = false
      sub.subscription?.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      loading,
      initialized,
      isSupabaseConfigured,
      isSystemAdmin: Boolean(profile?.is_system_admin),
      refreshProfile: () => session?.user && loadProfile(session.user.id),
      async signOut() {
        await authApi.signOut()
        setSession(null)
        setProfile(null)
      },
    }),
    [session, profile, loading, initialized, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
