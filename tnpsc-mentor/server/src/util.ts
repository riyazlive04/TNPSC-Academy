import type { NextFunction, Request, Response } from 'express'

/** Wrap an async route handler so thrown/rejected errors hit the error middleware. */
export function asyncH(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/** Translate a Supabase/PostgREST error into an HTTP response. */
export function sendDbError(res: Response, error: { message?: string } | null) {
  return res.status(400).json({ error: error?.message ?? 'Database error' })
}
