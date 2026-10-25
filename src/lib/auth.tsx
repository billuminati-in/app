import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type Profile = { id: string; display_name: string; email: string | null }
type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  recovering: boolean
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  session: null, profile: null, loading: true, recovering: false, refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  async function loadProfile(uid: string | undefined) {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles').select('id, display_name, email').eq('id', uid).maybeSingle()
    setProfile(data as Profile | null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfile(data.session?.user.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // defer: calling Supabase inside this callback can deadlock the auth lock
        setTimeout(() => loadProfile(s?.user.id), 0)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider value={{ session, profile, loading, recovering, refreshProfile: () => loadProfile(session?.user.id) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
