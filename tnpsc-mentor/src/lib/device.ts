// A stable per-browser device id, used by the server to limit how many devices
// can be signed into one account at once. Generated once and kept in
// localStorage; it is NOT a secret (it only identifies this browser to the
// session-limit bookkeeping).

const KEY = 'tnpsc:device_id'

export function getDeviceId(): string {
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
      /* ignore — a volatile id still works for this session */
    }
  }
  return id
}
