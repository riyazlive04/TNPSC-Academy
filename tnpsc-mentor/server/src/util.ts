import type { NextFunction, Request, Response } from 'express'
import { recordInfraDegraded } from './lib/securityAlerts.js'

/**
 * True when a Postgres function/RPC isn't deployed yet (migration not run), so
 * a route can fall back to a plain query. PGRST202 = PostgREST can't find the
 * function in its schema cache; 42883 = Postgres undefined_function.
 */
export function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = error.code ?? ''
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|does not exist/i.test(error.message ?? '')
  )
}

/** Wrap an async route handler so thrown/rejected errors hit the error middleware. */
export function asyncH(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Translate a Supabase/PostgREST error into an HTTP response.
 *
 * PostgREST error codes tell us whether the *request* was bad (client error,
 * 4xx) or the server/DB failed (5xx). We only echo the DB message for genuine
 * client errors; for everything else we log server-side and return a generic
 * message so raw DB internals never leak to the browser.
 */
export function sendDbError(
  res: Response,
  error: { message?: string; code?: string } | null
) {
  const code = error?.code ?? ''
  // PostgREST/PostgreSQL client-error classes:
  //   PGRST1xx  = malformed request   PGRST116 = no rows (single())
  //   23xxx     = integrity constraint violation (e.g. unique, fk, check)
  //   22xxx     = data exception (e.g. invalid text representation)
  //   42501     = insufficient privilege (RLS / grant) → forbidden
  const isClientError =
    code.startsWith('PGRST1') ||
    code.startsWith('23') ||
    code.startsWith('22')
  if (code === '42501') {
    return res.status(403).json({ error: 'Not authorized.' })
  }
  // PGRST116 is `.single()` finding 0 (or >1) rows. Its raw text — "Cannot
  // coerce the result to a single JSON object" — is PostgREST internals, and it
  // reached real users as a toast when seven accounts turned up with no profiles
  // row (see supabase/backfill_missing_profiles.sql). A missing row is a 404 to
  // the caller, not a sentence about JSON coercion.
  if (code === 'PGRST116') {
    console.error('[db error] PGRST116', error?.message)
    return res.status(404).json({ error: 'Not found.' })
  }
  if (isClientError) {
    return res.status(400).json({ error: error?.message ?? 'Invalid request.' })
  }
  // Genuine server/DB failure — log details, return a safe generic message.
  console.error('[db error]', error?.code, error?.message)
  if (code === '57014') {
    recordInfraDegraded('db_timeout', error?.message ?? 'statement timeout')
  }
  return res.status(500).json({ error: 'A server error occurred. Please try again.' })
}
