import { Flag } from 'lucide-react'
import ReportedQuestions from '../components/Admin/ReportedQuestions'
import { useT } from '../lib/i18n'

/**
 * Admin-facing page for triaging student-reported questions. Superadmins get the
 * same surface as a tab inside the /superadmin console; both render the shared
 * <ReportedQuestions /> component. Gated to admin (superadmin inherits) in App.tsx.
 */
export default function AdminReportsPage() {
  const { t } = useT()
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-6 lg:py-8">
        <header className="mb-6 flex items-center gap-3 animate-slideDown">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-coralsoft text-coral">
            <Flag size={22} />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-ink">
              {t('reportedQuestions')}
            </h1>
            <p className="font-body text-sm text-ink2">{t('reportedQuestionsSub')}</p>
          </div>
        </header>
        <ReportedQuestions />
      </div>
    </>
  )
}
