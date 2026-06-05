import { useAuthStore, selectIsAdmin, selectIsAuthenticated } from '../store/authStore'

/**
 * Convenience hook exposing the slice of auth state most pages need.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const isAdmin = useAuthStore(selectIsAdmin)

  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)
  const resetPassword = useAuthStore((s) => s.resetPassword)

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    isAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
