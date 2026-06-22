import { create } from 'zustand'

// Light/dark theming. The user picks 'light', 'dark', or 'system' (the default,
// which follows the OS). The resolved value drives the `.dark` class on <html>,
// which flips every CSS-variable token defined in index.css. A tiny inline
// script in index.html applies the initial theme before React mounts so there's
// no white flash; this store keeps it reactive afterwards.

export type ThemeMode = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'tnpsc:theme'

function readMode(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(mode: ThemeMode): Resolved {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

function apply(resolved: Resolved): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

interface ThemeState {
  mode: ThemeMode
  resolved: Resolved
  /** Set an explicit preference (or 'system'); persists + applies immediately. */
  setMode: (mode: ThemeMode) => void
  /** Flip between light and dark (becomes an explicit preference). */
  toggle: () => void
  /** Re-apply on mount and start listening for OS changes while in 'system'. */
  init: () => void
}

const initialMode = readMode()

// Guard against stacking matchMedia listeners when init() is called more than
// once (StrictMode double-mount, re-login). We register the OS-change handler at
// most once for the app's lifetime.
let mqListenerRegistered = false

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: resolve(initialMode),

  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* private mode / storage disabled - keep in-memory only */
    }
    const resolved = resolve(mode)
    apply(resolved)
    set({ mode, resolved })
  },

  toggle: () => {
    get().setMode(get().resolved === 'dark' ? 'light' : 'dark')
  },

  init: () => {
    const resolved = resolve(get().mode)
    apply(resolved)
    set({ resolved })
    if (mqListenerRegistered || typeof window === 'undefined') return
    mqListenerRegistered = true
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', () => {
      if (get().mode !== 'system') return
      const r = resolve('system')
      apply(r)
      set({ resolved: r })
    })
  },
}))
