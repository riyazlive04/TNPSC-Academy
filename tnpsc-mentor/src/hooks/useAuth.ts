import {
  useAuthStore,
  selectIsAdmin,
  selectIsSuperAdmin,
  selectIsAuthenticated,
} from '../store/authStore'
import { useAdminViewStore } from '../store/adminViewStore'

/**
 * Convenience hook exposing the slice of auth state most pages need.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const realIsAdmin = useAuthStore(selectIsAdmin)
  const realIsSuperAdmin = useAuthStore(selectIsSuperAdmin)

  // "Preview as student" (admins only): mask the effective role so every UI
  // consumer renders the learner experience. Non-admins can never be in preview.
  const previewAsStudent = useAdminViewStore((s) => s.previewAsStudent) && realIsAdmin
  const setPreviewAsStudent = useAdminViewStore((s) => s.setPreviewAsStudent)
  const isAdmin = realIsAdmin && !previewAsStudent
  const isSuperAdmin = realIsSuperAdmin && !previewAsStudent

  const signIn = useAuthStore((s) => s.signIn)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const replaceDevice = useAuthStore((s) => s.replaceDevice)
  const sendOtp = useAuthStore((s) => s.sendOtp)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const replaceDeviceOtp = useAuthStore((s) => s.replaceDeviceOtp)
  const replaceDeviceGoogle = useAuthStore((s) => s.replaceDeviceGoogle)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)
  const resetPassword = useAuthStore((s) => s.resetPassword)

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    /** The user's real role, ignoring student-preview (drives the preview toggle). */
    realIsAdmin,
    realIsSuperAdmin,
    /** True while a real admin is previewing the learner experience. */
    previewAsStudent,
    setPreviewAsStudent,
    signIn,
    signInWithGoogle,
    replaceDevice,
    sendOtp,
    verifyOtp,
    replaceDeviceOtp,
    replaceDeviceGoogle,
    signUp,
    signOut,
    resetPassword,
  }
}
