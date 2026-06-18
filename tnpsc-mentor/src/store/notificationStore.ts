import { create } from 'zustand'
import { api, isApiConfigured, type NotificationItem } from '../lib/api'

/**
 * In-app notification feed shared by the header bell. Fetched on demand and on a
 * light interval (started once the user is authenticated) so the unread badge
 * stays roughly current without a websocket.
 */
interface NotificationState {
  items: NotificationItem[]
  unread: number
  loading: boolean
  loaded: boolean
  refresh: () => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  loaded: false,
  refresh: async () => {
    if (!isApiConfigured) {
      set({ loaded: true })
      return
    }
    set({ loading: true })
    try {
      const { notifications, unread } = await api.notifications.feed()
      set({ items: notifications, unread, loaded: true })
    } catch {
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },
  markAllRead: async () => {
    const unreadIds = get().items.filter((i) => !i.read).map((i) => i.id)
    if (unreadIds.length === 0) return
    // Optimistic: clear the badge immediately, then persist.
    set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unread: 0 }))
    await api.notifications.markRead(unreadIds).catch(() => {})
  },
}))

// ─── Background polling (module-level, started once) ─────────────────────────
let pollTimer: ReturnType<typeof setInterval> | null = null

/** Begin periodic feed refreshes (idempotent). Call after sign-in. */
export function startNotificationPolling(): void {
  if (pollTimer) return
  useNotificationStore.getState().refresh()
  pollTimer = setInterval(() => useNotificationStore.getState().refresh(), 60_000)
}

/** Stop polling and clear the feed (call on sign-out). */
export function stopNotificationPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  useNotificationStore.setState({ items: [], unread: 0, loaded: false })
}
