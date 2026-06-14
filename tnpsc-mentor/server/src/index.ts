import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config, isAllowedOrigin } from './config.js'

import authRoutes from './routes/auth.js'
import questionRoutes from './routes/questions.js'
import testRoutes from './routes/tests.js'
import reviewRoutes from './routes/reviews.js'
import bookmarkRoutes from './routes/bookmarks.js'
import profileRoutes from './routes/profile.js'
import analyticsRoutes from './routes/analytics.js'
import adminRoutes from './routes/admin.js'
import superadminRoutes from './routes/superadmin.js'
import feedbackRoutes from './routes/feedback.js'

const app = express()

// Render/Vercel/most PaaS terminate TLS at a proxy that sets X-Forwarded-For.
// Trust the first proxy hop so req.ip is the real client IP and express-rate-limit
// stops throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR (which was 500-ing every
// request, including sign-in). '1' = trust exactly one proxy (Render's edge).
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    // Supports exact origins and `*` wildcards (Vercel preview URLs change every
    // deploy). An origin that isn't allowed simply gets no CORS headers → the
    // browser blocks it, which is the intended behaviour.
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))

// Gentle global rate limit; auth endpoints get a stricter one below.
app.use(
  '/api',
  rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false })
)
app.use(
  '/api/auth',
  rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false })
)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/tests', testRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/bookmarks', bookmarkRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use('/api/feedback', feedbackRoutes)

// 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Central error handler.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // eslint-disable-next-line no-console
    console.error('[api error]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
)

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`TNPSC Mentor API listening on http://localhost:${config.port}`)
})
