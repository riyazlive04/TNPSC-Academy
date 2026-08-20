import { create } from 'zustand'
import { api, type AuthConfig } from '../lib/api'

/**
 * Which optional auth methods the server has configured, fetched once at boot.
 * Every field defaults false until the fetch resolves, so a page that gates UI
 * on one of them (e.g. the Google button, the phone-OTP tab) simply renders as
 * "not configured" for that brief window rather than flashing in and out.
 */
export interface AuthConfigState extends AuthConfig {
  loaded: boolean
  init: () => Promise<void>
}

export const useAuthConfigStore = create<AuthConfigState>((set, get) => ({
  google: false,
  whatsappOtp: false,
  telegramVerify: false,
  phoneOtp: false,
  loaded: false,

  init: async () => {
    if (get().loaded) return
    try {
      const cfg = await api.auth.config()
      set({ ...cfg, loaded: true })
    } catch {
      // Boot-time network hiccup — leave every optional method hidden rather
      // than guess. Core email/password + Google-by-CLIENT_ID auth still work;
      // a reload retries this fetch.
      set({ loaded: true })
    }
  },
}))
