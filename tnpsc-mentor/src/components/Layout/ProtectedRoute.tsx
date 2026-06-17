import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, selectIsAdmin, selectIsSuperAdmin } from '../../store/authStore'
import { isApiConfigured } from '../../lib/api'
import { useT } from '../../lib/i18n'

interface ProtectedRouteProps {
  children: ReactNode
  /**
   * Optional role gate. 'admin' allows admins + superadmins; 'superadmin'
   * allows only superadmins. Users lacking the role are bounced to the arena.
   */
  role?: 'admin' | 'superadmin'
}

/**
 * Wraps all authenticated routes. While the initial session is bootstrapping
 * it shows a spinner; once resolved, unauthenticated users are redirected to
 * /login (preserving the attempted location). When `role` is set, users without
 * the required role are redirected to /test-arena.
 *
 * UI-preview mode: when the API isn't configured there's no backend to
 * authenticate against, so we let every page through to browse the interface.
 * This bypass is DEV-ONLY - a production build that ships without VITE_API_URL
 * must NOT silently disable auth (that would expose every admin console).
 */
export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const isAdmin = useAuthStore(selectIsAdmin)
  const isSuperAdmin = useAuthStore(selectIsSuperAdmin)
  const location = useLocation()
  const { t } = useT()

  if (!isApiConfigured && import.meta.env.DEV) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas bg-brand-radial">
        <div className="flex flex-col items-center gap-4 animate-fadeIn">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
          <p className="font-heading text-sm uppercase tracking-widest text-ink2">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (role === 'superadmin' && !isSuperAdmin) {
    return <Navigate to="/test-arena" replace />
  }
  if (role === 'admin' && !isAdmin) {
    return <Navigate to="/test-arena" replace />
  }

  return <>{children}</>
}
