import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config.js'

/**
 * Service-role client — full DB access, bypasses RLS. Used ONLY for trusted
 * server operations (auth admin lookups, never for forwarding raw user input
 * to privileged tables). Lives exclusively on the server.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Anon client used for the auth flows (sign in / up / refresh / reset). These
 * GoTrue calls don't need elevated privileges.
 */
export const supabaseAuthClient: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
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
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
