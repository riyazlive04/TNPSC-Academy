import { Capacitor } from '@capacitor/core'

/**
 * True in a browser, false inside the packaged Android/iOS app. Drives the
 * `web:` Tailwind variant (via `html.is-web`, set in main.tsx) and the website
 * chrome in AppLayout — the installed app keeps its native top bar + tabs.
 * `?native` in dev forces the app look so it can be checked on a desktop.
 */
export const IS_WEB =
  !Capacitor.isNativePlatform() &&
  !(import.meta.env.DEV && new URLSearchParams(window.location.search).has('native'))
