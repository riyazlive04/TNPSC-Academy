// ─── Firebase Cloud Messaging (HTTP v1) ─────────────────────────────────────
// Delivers push to the INSTALLED apps. Android talks to FCM directly; iOS is
// reached through the same call because the APNs auth key is uploaded into the
// Firebase project, so there is exactly one sender to reason about.
//
// Separate from web-push (notify.ts) because the transports have nothing in
// common: Web Push signs a VAPID JWT per endpoint and encrypts the payload
// client-side, FCM authenticates the whole request with a service account and
// takes a plain JSON body.

import { JWT } from 'google-auth-library'
import { config } from '../config.js'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

export interface FcmMessage {
  title: string
  body: string
  /** Relative in-app path the notification opens, e.g. "/test-series". */
  url?: string | null
  /** Our notification row id, so a tap can mark it read. */
  id?: string
}

/** Reuses the Play service account when a Firebase-specific one isn't set —
 *  both are Google service accounts and one project usually owns both. */
function serviceAccountJson(): string {
  return (
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    config.googlePlayServiceAccountJson ||
    ''
  ).trim()
}

export function fcmEnabled(): boolean {
  return Boolean(serviceAccountJson() && projectId())
}

function projectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID
  try {
    const parsed = JSON.parse(decodeKey(serviceAccountJson())) as { project_id?: string }
    return parsed.project_id ?? ''
  } catch {
    return ''
  }
}

function decodeKey(raw: string): string {
  return raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
}

let client: JWT | null = null

function jwtClient(): JWT {
  if (client) return client
  const parsed = JSON.parse(decodeKey(serviceAccountJson())) as {
    client_email: string
    private_key: string
  }
  client = new JWT({
    email: parsed.client_email,
    key: parsed.private_key.replace(/\\n/g, '\n'),
    scopes: [SCOPE],
  })
  return client
}

/** FCM error codes that mean "this token is dead, stop using it". */
const DEAD_TOKEN = new Set(['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'])

export interface FcmSendResult {
  sent: number
  /** Tokens the caller should delete — FCM says they will never deliver again. */
  dead: string[]
}

/**
 * Send one message to many device tokens. Best-effort: never throws, so a push
 * failure can't break the action that triggered it.
 *
 * FCM v1 has no multicast endpoint — each token is its own request — but the
 * volumes here (one user, or a broadcast measured in thousands) are fine sent
 * concurrently.
 */
export async function sendFcm(tokens: string[], msg: FcmMessage): Promise<FcmSendResult> {
  if (!fcmEnabled() || tokens.length === 0) return { sent: 0, dead: [] }

  const url = `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`
  const dead: string[] = []
  let sent = 0

  // `data` carries the deep-link path; `notification` is what the OS renders when
  // the app is backgrounded. Both are set so a tap works either way.
  const data: Record<string, string> = {}
  if (msg.url) data.url = msg.url
  if (msg.id) data.id = msg.id

  const results = await Promise.allSettled(
    tokens.map((token) =>
      jwtClient().request({
        url,
        method: 'POST',
        data: {
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data,
            android: {
              priority: 'HIGH',
              notification: { default_sound: true },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default' } },
            },
          },
        },
      })
    )
  )

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++
      return
    }
    const reason = r.reason as {
      response?: { data?: { error?: { status?: string; details?: { errorCode?: string }[] } } }
    }
    const err = reason?.response?.data?.error
    const code = err?.details?.find((d) => d.errorCode)?.errorCode ?? err?.status ?? ''
    if (DEAD_TOKEN.has(code)) dead.push(tokens[i])
  })

  return { sent, dead }
}
