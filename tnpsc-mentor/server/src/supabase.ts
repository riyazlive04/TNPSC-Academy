import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.js'

/**
 * The VPS's route to Supabase's Cloudflare-fronted edge occasionally hits a
 * connect-phase blip (`UND_ERR_CONNECT_TIMEOUT` / "fetch failed") — no bytes
 * of the request ever go out, so a retry can never double-submit anything.
 * Without this, ANY such blip surfaced as a hard failure on every call that
 * goes through Supabase, including `requireAuth`'s getUser() (runs on nearly
 * every authenticated request) and login/register's signInWithPassword/signUp
 * — which is what users saw as "Failed to fetch" / "can't reach server". Two
 * quick retries turn a rare blip into added latency instead of a dead request.
 */
async function resilientFetch(...args: Parameters<typeof fetch>): Promise<Response> {
  const ATTEMPTS = 3
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await fetch(...args)
    } catch (err) {
      if (attempt === ATTEMPTS) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
  throw new Error('unreachable') // ATTEMPTS >= 1 always returns or throws above
}

/**
 * Service-role client — full DB access, bypasses RLS. Used ONLY for trusted
 * server operations (auth admin lookups, never for forwarding raw user input
 * to privileged tables). Lives exclusively on the server.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: resilientFetch } }
)

/**
 * Anon client used for the auth flows (sign in / up / refresh / reset). These
 * GoTrue calls don't need elevated privileges.
 */
export const supabaseAuthClient: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: resilientFetch } }
)

/**
 * Build a request-scoped client that carries the END USER's access token.
 * Every query made through it runs as that user, so the existing Row-Level
 * Security policies and `auth.uid()`-based SECURITY DEFINER RPCs behave EXACTLY
 * as they did when the browser talked to Supabase directly. This is what lets
 * the Express layer slot in front of the DB without rewriting a single policy.
 */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` }, fetch: resilientFetch },
  })
}
