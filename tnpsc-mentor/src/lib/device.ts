// A stable per-browser device id, used by the server to limit how many devices
// can be signed into one account at once. Generated once and kept in
// localStorage; it is NOT a secret (it only identifies this browser to the
// session-limit bookkeeping).

const KEY = 'tnpsc:device_id'

// Cache the id for the lifetime of the page. When localStorage is unavailable
// (private mode / blocked storage) BOTH reads and writes throw, so without this
// cache every call would mint a fresh UUID — tripping the 2-device login cap and
// locking the user out. The cache keeps one stable id per session regardless.
let cachedId = ''

export function getDeviceId(): string {
  if (cachedId) return cachedId

  let id = ''
  try {
    id = localStorage.getItem(KEY) ?? ''
  } catch {
    /* storage blocked — fall through to a volatile id */
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* ignore — the module-level cache keeps it stable for this session */
    }
  }
  cachedId = id
  return id
}
