import { create } from 'zustand'
import { api, isApiConfigured } from '../lib/api'
import { BADGE_POLL_MS, startPolling } from '../lib/poll'

/**
 * Unread badge for the header Messages icon. Deliberately separate from
 * notificationStore: a message thread is its own surface (/messages), and
 * this store only tracks the count — the full thread is fetched by the page
 * itself on open. Same light-poll pattern as notifications (no websocket).
 */
interface MessageState {
  unread: number
  refresh: () => Promise<void>
  clear: () => void
}

export const useMessageStore = create<MessageState>((set) => ({
  unread: 0,
  refresh: async () => {
    if (!isApiConfigured) return
    try {
      const count = await api.messages.unreadCount()
      set({ unread: count })
    } catch {
      // Best-effort — a failed poll just leaves the last-known badge showing.
    }
  },
  clear: () => set({ unread: 0 }),
}))

let stopPoll: (() => void) | null = null

/** Begin periodic unread-count refreshes (idempotent). Call after sign-in. */
export function startMessagePolling(): void {
  if (stopPoll) return
  stopPoll = startPolling(() => void useMessageStore.getState().refresh(), BADGE_POLL_MS)
}

/** Stop polling and clear the badge (call on sign-out). */
export function stopMessagePolling(): void {
  stopPoll?.()
  stopPoll = null
  useMessageStore.getState().clear()
}
