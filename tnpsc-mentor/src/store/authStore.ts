import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean // initial session bootstrap
  initialized: boolean

  init: () => Promise<void>
  setSession: (session: Session | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export interface SignUpParams {
  fullName: string
  email: string
  phone: string
  password: string
  targetGroup: string
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null, loading: false })
      if (session?.user) {
        await get().fetchProfile(session.user.id)
      }

      // Keep store in sync with auth lifecycle events.
      supabase.auth.onAuthStateChange((_event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null })
        if (newSession?.user) {
          get().fetchProfile(newSession.user.id)
        } else {
          set({ profile: null })
        }
      })
    } catch (e) {
      // Even if Supabase is unreachable, stop the loading spinner.
      set({ loading: false })
    }
  },

  setSession: (session) => set({ session, user: session?.user ?? null }),

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (!error && data) {
        set({ profile: data as Profile })
      }
    } catch {
      /* non-fatal — profile may not exist yet */
    }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) return { error: error.message }
    set({ session: data.session, user: data.user })
    if (data.user) await get().fetchProfile(data.user.id)
    return { error: null }
  },

  signUp: async ({ fullName, email, phone, password, targetGroup }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName },
      },
    })
    if (error) return { error: error.message }

    // Upsert the profile row (the DB trigger also creates a base row; we
    // enrich it here with phone + target group). Best-effort — if RLS or the
    // session isn't ready yet we still let signup succeed.
    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          email: email.trim(),
          phone,
          target_group: targetGroup,
        })
      } catch {
        /* non-fatal */
      }
      set({ session: data.session, user: data.user })
      await get().fetchProfile(data.user.id)
    }
    return { error: null }
  },

  resetPassword: async (email) => {
    const redirectTo = `${window.location.origin}/login`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    if (error) return { error: error.message }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },
}))

// Selector helpers -----------------------------------------------------------

export function selectIsAuthenticated(s: AuthState): boolean {
  return Boolean(s.user)
}

export function selectRole(s: AuthState): UserRole {
  return (s.profile?.role as UserRole) ?? 'user'
}

export function selectIsAdmin(s: AuthState): boolean {
  return s.profile?.role === 'admin'
}
