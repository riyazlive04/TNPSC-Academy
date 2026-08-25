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
    // Live (OTA) web-bundle updates, served by our OWN server — see
    // server/src/routes/app.ts (/api/app/web-bundle/check) and
    // docs/LIVE-UPDATES.md. Web assets ship in minutes instead of waiting on a
    // store review; anything native still needs a real release.
    CapacitorUpdater: {
      updateUrl: 'https://app.tnpscmentors.in/api/app/web-bundle/check',
      // Capgo's cloud is not involved: no stats leave the device. (channelUrl
      // is never reached because the app never calls setChannel.)
      statsUrl: '',
      // Check on every foreground, download in the background, and swap only
      // when the app NEXT goes to background. Never mid-session: a reload
      // during a proctored mock test would count as a violation and lose the
      // attempt.
      autoUpdate: 'atBackground',
      // A Play/App Store update wipes downloaded bundles, so a build that
      // predates a newly added native plugin can never be restored over it.
      resetWhenUpdate: true,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      // If a bundle fails to boot and call notifyAppReady() within this window,
      // the plugin rolls back to the previous one by itself. Generous, because
      // a cold start on a cheap Android device is genuinely slow.
      appReadyTimeout: 15000,
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
