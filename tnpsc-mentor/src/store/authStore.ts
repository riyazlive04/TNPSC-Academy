import { create } from 'zustand'
import { api, tokens, isApiConfigured } from '../lib/api'
import { useLanguageStore } from './languageStore'
import type { Profile, UserRole } from '../types'

/** Adopt the account's saved language so the preference follows the user across
 * devices and the one-time language screen isn't shown again after onboarding.
 * No-op when the profile has no language yet (keeps the local choice). */
function applyProfileLanguage(profile: Profile | null): void {
  const lang = profile?.language
  if (lang === 'en' || lang === 'ta' || lang === 'both') {
    useLanguageStore.getState().setLang(lang)
  }
}

/** Minimal user identity (the browser no longer holds a Supabase session). */
export interface AuthUser {
  id: string
}

export interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean // initial session bootstrap
  initialized: boolean

  init: () => Promise<void>
  fetchProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: (idToken: string) => Promise<{ error: string | null }>
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
  profile: null,
  loading: true,
  initialized: false,

  // Re-hydrate from a stored access token on app boot (token refresh is handled
  // transparently inside the API client).
  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    if (!isApiConfigured || !tokens.access) {
      set({ loading: false })
      return
    }
    try {
      const { user, profile } = await api.auth.me()
      applyProfileLanguage(profile)
      set({ user, profile, loading: false })
    } catch {
      tokens.clear()
      set({ user: null, profile: null, loading: false })
    }
  },

  fetchProfile: async () => {
    try {
      const profile = await api.getProfile()
      set({ profile })
    } catch {
      /* non-fatal - profile may not exist yet */
    }
  },

  signIn: async (email, password) => {
    try {
      const { user, profile } = await api.auth.login(email.trim(), password)
      applyProfileLanguage(profile)
      set({ user, profile })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign in failed' }
    }
  },

  signInWithGoogle: async (idToken) => {
    try {
      const { user, profile } = await api.auth.google(idToken)
      applyProfileLanguage(profile)
      set({ user, profile })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Google sign-in failed' }
    }
  },

  signUp: async (params) => {
    try {
      const res = await api.auth.register({ ...params, email: params.email.trim() })
      if ('requiresConfirmation' in res) {
        return { error: 'Check your email to confirm your account, then sign in.' }
      }
      applyProfileLanguage(res.profile)
      set({ user: res.user, profile: res.profile })
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign up failed' }
    }
  },

  resetPassword: async (email) => {
    try {
      await api.auth.forgotPassword(email.trim(), `${window.location.origin}/login`)
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not send reset email' }
    }
  },

  signOut: async () => {
    api.auth.logout()
    set({ user: null, profile: null })
  },
}))

// Selector helpers -----------------------------------------------------------

export function selectIsAuthenticated(s: AuthState): boolean {
  return Boolean(s.user)
}

export function selectRole(s: AuthState): UserRole {
  return (s.profile?.role as UserRole) ?? 'user'
}

// Superadmins inherit all admin abilities, so admin-gated UI treats them as
// admins too. Use `selectIsSuperAdmin` for the superadmin-only console.
export function selectIsAdmin(s: AuthState): boolean {
  return s.profile?.role === 'admin' || s.profile?.role === 'superadmin'
}

export function selectIsSuperAdmin(s: AuthState): boolean {
  return s.profile?.role === 'superadmin'
}

// A Google signup arrives with only name/email — no target group or phone. Such
// aspirants are routed through /complete-profile until both are filled. Admins and
// superadmins are seeded directly and skip this onboarding gate.
export function selectProfileNeedsOnboarding(s: AuthState): boolean {
  const p = s.profile
  if (!p) return false
  if (p.role === 'admin' || p.role === 'superadmin') return false
  return !p.target_group || !p.phone
}
