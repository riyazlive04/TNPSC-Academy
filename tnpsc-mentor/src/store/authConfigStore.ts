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
  /** Superadmin-controlled app-wide maintenance flag (GET /api/app/settings,
   *  fetched alongside auth config since both are needed at boot). See
   *  App.tsx's AnimatedRoutes for the full-screen gate, and lib/api.ts's
   *  request() for the reactive 503 → true flip on an already-open tab. */
  maintenanceMode: boolean
  init: () => Promise<void>
}

export const useAuthConfigStore = create<AuthConfigState>((set, get) => ({
  google: false,
  whatsappOtp: false,
  telegramVerify: false,
  phoneOtp: false,
  loaded: false,
  maintenanceMode: false,

  init: async () => {
    if (get().loaded) return
    // allSettled, not all: these two calls are unrelated (auth-method config
    // vs. public app settings) and must fail independently — one endpoint
    // being down (e.g. a Supabase-REST outage affecting only /api/app/settings)
    // shouldn't also blank out the other's already-succeeded result.
    const [cfgResult, settingsResult] = await Promise.allSettled([
      api.auth.config(),
      api.appSettings(),
    ])
    set({
      ...(cfgResult.status === 'fulfilled' ? cfgResult.value : {}),
      maintenanceMode:
        settingsResult.status === 'fulfilled' ? settingsResult.value.maintenance_mode : false,
      loaded: true,
    })
  },
}))
