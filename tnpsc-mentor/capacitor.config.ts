import type { CapacitorConfig } from '@capacitor/cli'

// Web OAuth Client ID — the SAME value as VITE_GOOGLE_CLIENT_ID and the server's
// GOOGLE_CLIENT_ID. Used as the Google `webClientId` so the native sign-in returns
// an ID token whose audience is this web client, which Supabase already trusts.
const GOOGLE_WEB_CLIENT_ID =
  '67295167549-tetha1nh7ltk2ivs5jj1ndp6eai3bvm4.apps.googleusercontent.com'

const config: CapacitorConfig = {
  appId: 'com.tnpscmentor.app',
  appName: 'TNPSC Mentors',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    // Apple rejects apps whose content sits under the status bar / home indicator.
    // The web layer handles insets via env(safe-area-inset-*) (index.css), which
    // only reports real values with viewport-fit=cover set in index.html.
    contentInset: 'never',
    // Links to policy pages, YouTube explanations, etc. open in SFSafariViewController
    // rather than punting the user out to Safari and losing the app context.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SocialLogin: {
      // Bundle ONLY Google. Left at the default every provider ships, which drags
      // the Facebook SDK into the binary — that alone forces a "Data Used to Track
      // You" privacy label and an App Tracking Transparency prompt for an SDK the
      // app never calls.
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    PushNotifications: {
      // Badge is never used; alert+sound only. Keeps the iOS permission prompt
      // scoped to what the app actually does.
      presentationOptions: ['alert', 'sound'],
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      androidSplashResourceName: 'splash',
      showSpinner: false,
      backgroundColor: '#FFFFFF',
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      // The exam screens are scroll containers; resizing the body reflows the
      // question card instead of hiding it behind the keyboard.
      resize: 'body' as never,
      resizeOnFullScreen: true,
    },
  },
}

// Google's `webClientId` is read at runtime from lib/nativeAuth.ts via
// SocialLogin.initialize(); it is duplicated here only so a build that skips that
// call still has a valid client id on hand.
export const GOOGLE_CLIENT_ID = GOOGLE_WEB_CLIENT_ID

export default config
