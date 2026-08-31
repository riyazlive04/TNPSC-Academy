import { create } from 'zustand'
import { api, isApiConfigured, type NotificationItem } from '../lib/api'
import { BADGE_POLL_MS, startPolling } from '../lib/poll'

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
    const prevItems = get().items
    const prevUnread = get().unread
    const unreadIds = prevItems.filter((i) => !i.read).map((i) => i.id)
    if (unreadIds.length === 0) return
    // Optimistic: clear the badge immediately, then persist. Roll back to the
    // prior unread state if the network call fails so the badge stays truthful.
    set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })), unread: 0 }))
    try {
      await api.notifications.markRead(unreadIds)
    } catch {
      set({ items: prevItems, unread: prevUnread })
    }
  },
}))

// ─── Background polling (module-level, started once) ─────────────────────────
let stopPoll: (() => void) | null = null

/** Begin periodic feed refreshes (idempotent). Call after sign-in. */
export function startNotificationPolling(): void {
  if (stopPoll) return
  stopPoll = startPolling(() => void useNotificationStore.getState().refresh(), BADGE_POLL_MS)
}

/** Stop polling and clear the feed (call on sign-out). */
export function stopNotificationPolling(): void {
  stopPoll?.()
  stopPoll = null
  useNotificationStore.setState({ items: [], unread: 0, loaded: false })
}
