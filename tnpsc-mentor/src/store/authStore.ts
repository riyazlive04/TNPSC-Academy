import { create } from 'zustand'
import { api, tokens, isApiConfigured, canTryRefresh, ApiError, type DeviceSession } from '../lib/api'
import { useLanguageStore } from './languageStore'
import { trackLogin, trackSignUp, setUserId } from '../lib/tracking'
import type { Profile, UserRole } from '../types'

/** Result of a sign-in attempt. `deviceLimit` means the account is already on
 * the max number of devices - `devices` carries them so the UI can offer to
 * sign one out. */
export interface SignInResult {
  error: string | null
  deviceLimit?: boolean
  devices?: DeviceSession[]
  /** Present only on an OTP-login device-limit block — proves the just-verified
   * OTP so the device replace can finish without a fresh code. */
  ticket?: string
}

/** Pull the device list off a `device_limit` 403, or null if it's a different error. */
function deviceLimitFrom(e: unknown): DeviceSession[] | null {
  if (
    e instanceof ApiError &&
    e.status === 403 &&
    (e.data as { error?: string })?.error === 'device_limit'
  ) {
    return ((e.data as { devices?: DeviceSession[] }).devices ?? []) as DeviceSession[]
  }
  return null
}

/** Pull the OTP replace-ticket off a `device_limit` 403, if the server sent one. */
function otpTicketFrom(e: unknown): string | undefined {
  if (e instanceof ApiError && e.status === 403) {
    const t = (e.data as { ticket?: string })?.ticket
    return typeof t === 'string' ? t : undefined
  }
  return undefined
}

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
  signIn: (email: string, password: string) => Promise<SignInResult>
  signInWithGoogle: (idToken: string) => Promise<SignInResult>
  /** Sign out one existing device (by session id) and sign in here. */
  replaceDevice: (email: string, password: string, sessionId: string) => Promise<SignInResult>
  /** Phone-OTP: request a code for a registered number. `notRegistered` flags a
   * number with no account so the UI can point the user to sign up. */
  sendOtp: (phone: string) => Promise<{ error: string | null; notRegistered?: boolean }>
  /** Phone-OTP: verify the code and sign in. */
  verifyOtp: (phone: string, otp: string) => Promise<SignInResult>
  /** Phone-OTP: after a device-limit block, sign out a device and finish via ticket. */
  replaceDeviceOtp: (ticket: string, sessionId: string) => Promise<SignInResult>
  /** Google: after a device-limit block, sign out a device and finish by
   * re-verifying the same Google ID token. */
  replaceDeviceGoogle: (idToken: string, sessionId: string) => Promise<SignInResult>
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export interface SignUpParams {
  fullName: string
  email: string
  phone: string
  gender?: string
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
    // Boot if we have an access token OR (on web) a possible HttpOnly refresh
    // cookie - api.auth.me() triggers a transparent cookie-based refresh when the
    // access token is absent/expired, so a returning web user stays signed in
    // without the refresh token ever being readable by JS.
    if (!isApiConfigured || (!tokens.access && !canTryRefresh())) {
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
      trackLogin('password')
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices }
      return { error: e instanceof Error ? e.message : 'Sign in failed' }
    }
  },

  signInWithGoogle: async (idToken) => {
    try {
      const { user, profile } = await api.auth.google(idToken)
      applyProfileLanguage(profile)
      set({ user, profile })
      trackLogin('google')
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices }
      return { error: e instanceof Error ? e.message : 'Google sign-in failed' }
    }
  },

  replaceDevice: async (email, password, sessionId) => {
    try {
      const { user, profile } = await api.auth.replaceDevice(email.trim(), password, sessionId)
      applyProfileLanguage(profile)
      set({ user, profile })
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices }
      return { error: e instanceof Error ? e.message : 'Could not switch device' }
    }
  },

  replaceDeviceGoogle: async (idToken, sessionId) => {
    try {
      const { user, profile } = await api.auth.googleReplaceDevice(idToken, sessionId)
      applyProfileLanguage(profile)
      set({ user, profile })
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices }
      return { error: e instanceof Error ? e.message : 'Could not switch device' }
    }
  },

  sendOtp: async (phone) => {
    try {
      await api.auth.otpSend(phone)
      return { error: null }
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 404 &&
        (e.data as { error?: string })?.error === 'phone_not_registered'
      ) {
        return { error: null, notRegistered: true }
      }
      return { error: e instanceof Error ? e.message : 'Could not send code' }
    }
  },

  verifyOtp: async (phone, otp) => {
    try {
      const { user, profile } = await api.auth.otpVerify(phone, otp)
      applyProfileLanguage(profile)
      set({ user, profile })
      trackLogin('otp')
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices, ticket: otpTicketFrom(e) }
      return { error: e instanceof Error ? e.message : 'Sign in failed' }
    }
  },

  replaceDeviceOtp: async (ticket, sessionId) => {
    try {
      const { user, profile } = await api.auth.otpReplaceDevice(ticket, sessionId)
      applyProfileLanguage(profile)
      set({ user, profile })
      return { error: null }
    } catch (e) {
      const devices = deviceLimitFrom(e)
      if (devices) return { error: null, deviceLimit: true, devices, ticket: otpTicketFrom(e) }
      return { error: e instanceof Error ? e.message : 'Could not switch device' }
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
      trackSignUp('password')
      return { error: null }
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'phone_already_registered') {
        return { error: 'This mobile number is already registered to another account. Please sign in, or use a different number.' }
      }
      if (code === 'email_registered_google') {
        return { error: 'This email is registered with Google. Please use “Continue with Google” to sign in.' }
      }
      if (code === 'email_already_registered') {
        return { error: 'This email is already registered to another account. Please sign in instead.' }
      }
      return { error: code || 'Sign up failed' }
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

// Keep GA4's User-ID in sync with the signed-in user (cross-device identity).
// Fires on every auth transition — login, OTP/Google sign-in, boot re-hydration,
// and sign-out (which detaches by pushing a null id).
useAuthStore.subscribe((state, prev) => {
  const id = state.user?.id ?? null
  if (id !== (prev.user?.id ?? null)) setUserId(id)
})

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

// A Google signup arrives with only name/email - no phone. Such aspirants are
// routed through /complete-profile until phone is filled. (Target group is no
// longer collected; a default is applied server-side.) Admins and superadmins
// are seeded directly and skip this onboarding gate.
export function selectProfileNeedsOnboarding(s: AuthState): boolean {
  const p = s.profile
  if (!p) return false
  if (p.role === 'admin' || p.role === 'superadmin') return false
  return !p.phone
}
