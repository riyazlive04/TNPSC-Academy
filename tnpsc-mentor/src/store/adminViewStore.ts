import { create } from 'zustand'

// "Preview as student" — lets an admin/superadmin temporarily see the app exactly
// as a regular learner does (student nav, dashboards, feature visibility). It is a
// PRESENTATION-only override: it masks the effective isAdmin/isSuperAdmin returned
// by useAuth() so every UI consumer renders the student experience. Route access
// (ProtectedRoute) still uses the real role, so the admin is never locked out and
// can flip straight back.
//
// Intentionally NOT persisted: a hard refresh resets to the admin view, so an
// admin can never get silently "stuck" in preview across sessions.

interface AdminViewState {
  /** True while an admin is previewing the student experience. */
  previewAsStudent: boolean
  setPreviewAsStudent: (v: boolean) => void
  toggle: () => void
}

export const useAdminViewStore = create<AdminViewState>((set) => ({
  previewAsStudent: false,
  setPreviewAsStudent: (v) => set({ previewAsStudent: v }),
  toggle: () => set((s) => ({ previewAsStudent: !s.previewAsStudent })),
}))
