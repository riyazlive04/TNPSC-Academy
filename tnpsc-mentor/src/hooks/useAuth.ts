import {
  useAuthStore,
  selectIsAdmin,
  selectIsSuperAdmin,
  selectIsAuthenticated,
} from '../store/authStore'

/**
 * Convenience hook exposing the slice of auth state most pages need.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const isAdmin = useAuthStore(selectIsAdmin)
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)

  const signIn = useAuthStore((s) => s.signIn)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const replaceDevice = useAuthStore((s) => s.replaceDevice)
  const sendOtp = useAuthStore((s) => s.sendOtp)
  const verifyOtp = useAuthStore((s) => s.verifyOtp)
  const replaceDeviceOtp = useAuthStore((s) => s.replaceDeviceOtp)
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
    signIn,
    signInWithGoogle,
    replaceDevice,
    sendOtp,
    verifyOtp,
    replaceDeviceOtp,
    signUp,
    signOut,
    resetPassword,
  }
}
