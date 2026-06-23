import { config } from '../config.js'
import { supabaseAdmin } from '../supabase.js'

// Public Storage bucket holding the uploaded .apk binaries. Created once by
// server/setup-app-releases.mjs (idempotent). Public so the download URL needs
// no signing — the bucket only ever holds the app installer.
export const APK_BUCKET = 'app-releases'

const STORAGE_BASE = `${config.supabaseUrl.replace(/\/$/, '')}/storage/v1/object`

/** Public CDN URL for an object in the APK bucket. */
export function apkPublicUrl(storagePath: string): string {
  return `${STORAGE_BASE}/public/${APK_BUCKET}/${storagePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
}

export interface ReleaseRow {
  id: string
  version_name: string
  file_name: string
  storage_path: string
  file_size: number
  notes: string | null
  created_by: string | null
  created_at: string
}

/** The current release = newest row, or null when nothing has been uploaded. */
export async function currentRelease(): Promise<ReleaseRow | null> {
  const { data, error } = await supabaseAdmin
    .from('app_releases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as ReleaseRow) ?? null
}
