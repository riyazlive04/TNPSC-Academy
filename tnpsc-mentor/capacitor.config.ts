import type { CapacitorConfig } from '@capacitor/cli'

// Web OAuth Client ID — the SAME value as VITE_GOOGLE_CLIENT_ID and the server's
// GOOGLE_CLIENT_ID. Used as `serverClientId` so the native sign-in returns an ID
// token whose audience is this web client, which Supabase already trusts.
const GOOGLE_WEB_CLIENT_ID =
  '67295167549-tetha1nh7ltk2ivs5jj1ndp6eai3bvm4.apps.googleusercontent.com'

const config: CapacitorConfig = {
  appId: 'com.tnpscmentor.app',
  appName: 'TNPSC Mentor',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // The Android plugin reads `clientId` (falls back to here if the JS
      // initialize() call ever omits it); pass the WEB client id so the ID
      // token audience matches what the server/Supabase trust.
      clientId: GOOGLE_WEB_CLIENT_ID,
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      forceCodeForRefreshToken: false,
    },
  },
}

export default config
