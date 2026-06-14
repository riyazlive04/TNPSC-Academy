import 'dotenv/config'

/** Read a required env var or fail fast at boot with a clear message. */
function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required env var: ${name}. See server/.env.example`)
    process.exit(1)
  }
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
}
