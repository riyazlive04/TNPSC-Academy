import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { config, isAllowedOrigin } from './config.js'

import authRoutes from './routes/auth.js'
import questionRoutes from './routes/questions.js'
import testRoutes from './routes/tests.js'
import reviewRoutes from './routes/reviews.js'
import revisionRoutes from './routes/revisions.js'
import bookmarkRoutes from './routes/bookmarks.js'
import profileRoutes from './routes/profile.js'
import analyticsRoutes from './routes/analytics.js'
import adminRoutes from './routes/admin.js'
import superadminRoutes from './routes/superadmin.js'
import feedbackRoutes from './routes/feedback.js'
import paymentRoutes from './routes/payments.js'
import couponRoutes from './routes/coupons.js'
import notificationRoutes from './routes/notifications.js'
import thirukuralRoutes from './routes/thirukural.js'
import materialRoutes from './routes/materials.js'
import creditRoutes from './routes/credits.js'
import appRoutes from './routes/app.js'
import telegramRoutes from './routes/telegram.js'

const app = express()

// Nginx fronts the API on the VPS and sets X-Forwarded-For/Proto (see
// deploy/nginx-tnpsc.conf). Trust the first proxy hop so req.ip is the real
// client IP and express-rate-limit stops throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// (which was 500-ing every request, including sign-in). '1' = trust exactly one
// proxy (Nginx).
app.set('trust proxy', 1)

app.use(helmet())
app.use(
  cors({
    // Supports exact origins (the app + main + www domains) and `*` wildcards
    // within a single DNS label. An origin that isn't allowed simply gets no CORS
    // headers → the browser blocks it, which is the intended behaviour.
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    // The WEB client holds its refresh token in an HttpOnly cookie, so credentialed
    // requests must be allowed. cors echoes the exact (allowed) Origin and sets
    // Access-Control-Allow-Credentials — it never uses `*` with credentials. The
    // native app keeps using a Bearer token and doesn't rely on the cookie.
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

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
app.use('/api/revisions', revisionRoutes)
app.use('/api/bookmarks', bookmarkRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/coupons', couponRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/thirukural', thirukuralRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/credits', creditRoutes)
app.use('/api/app', appRoutes)
app.use('/api/telegram', telegramRoutes)

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
    // Honour an explicit status on the error (e.g. a 4xx thrown by a handler);
    // default to 500. For a genuine 5xx we still hide internals behind a generic
    // message, but a 4xx may carry a client-safe message.
    const raw = (err as { status?: unknown; statusCode?: unknown }).status ??
      (err as { statusCode?: unknown }).statusCode
    const status = typeof raw === 'number' && raw >= 400 && raw <= 599 ? raw : 500
    const message = status >= 500 ? 'Internal server error' : (err.message || 'Request error')
    res.status(status).json({ error: message })
  }
)

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`TNPSC Mentors API listening on http://localhost:${config.port}`)
})
