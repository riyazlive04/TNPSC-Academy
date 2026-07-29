// ─── Route chunk prefetching ─────────────────────────────────────────────────
// Every page ships as its own chunk (see the lazy() table in App.tsx), which
// keeps the first load small but means the FIRST visit to a tab waits on a
// download before anything can render. Warming those chunks ahead of the tap
// removes that wait entirely.
//
// Two moments matter:
//   • browser idle after boot — warm the tabs the user is most likely to open;
//   • pointer-down / hover on a nav tab — warm that exact chunk while the
//     finger is still on the glass (a tap takes ~100 ms longer than the fetch
//     usually needs on a warm connection).
//
// The specifiers below are the SAME strings App.tsx passes to lazy(), so Vite
// resolves them to the same chunk and the module registry dedupes — a prefetch
// followed by a real navigation never downloads twice.

type Loader = () => Promise<unknown>

/** Path → its page chunk. Only routes worth warming need an entry. */
const LOADERS: Record<string, Loader> = {
  '/test-arena': () => import('../pages/TestArenaPage'),
  '/test-arena/pyq': () => import('../pages/PyqGroupChooserPage'),
  '/test-arena/pyq/group1': () => import('../pages/PreviousYearPage'),
  '/test-arena/subjects': () => import('../pages/SubjectPracticePage'),
  '/test-arena/current-affairs': () => import('../pages/CurrentAffairsPage'),
  '/test-arena/aptitude': () => import('../pages/AptitudePage'),
  '/quiz/instructions': () => import('../pages/QuizInstructionsPage'),
  '/quiz': () => import('../pages/QuizPage'),
  '/result': () => import('../pages/ResultPage'),
  '/mock': () => import('../pages/MockTestPage'),
  '/revision': () => import('../pages/RevisionPage'),
  '/materials': () => import('../pages/MaterialsPage'),
  '/insights': () => import('../pages/InsightsPage'),
  '/profile': () => import('../pages/ProfilePage'),
  '/test-series': () => import('../pages/TestSeriesPage'),
  '/vettri': () => import('../pages/VettriPage'),
  '/daily': () => import('../pages/DailyPage'),
  '/bookmarks': () => import('../pages/BookmarksPage'),
  '/admin/reports': () => import('../pages/AdminReportsPage'),
}

/** Already requested — a hover that fires 20 times must still fetch once. */
const warmed = new Set<string>()

/**
 * Warm one route's chunk. Safe to call on every hover/tap: repeat calls are
 * no-ops, an unknown path is ignored, and a failed fetch is swallowed (the
 * real navigation will surface the error properly).
 */
export function prefetchRoute(path: string): void {
  if (warmed.has(path)) return
  const load = LOADERS[path]
  if (!load) return
  warmed.add(path)
  void load().catch(() => warmed.delete(path))
}

/** Warm several routes (used for the idle warm-up after boot). */
export function prefetchRoutes(paths: readonly string[]): void {
  for (const p of paths) prefetchRoute(p)
}

/**
 * Warmed during the first browser idle after boot: every learner nav tab plus
 * the test flow. These are the navigations a user makes within seconds of the
 * dashboard appearing, and the whole set is a few kB gzipped.
 */
export const PREFETCH_ON_BOOT = [
  '/test-arena',
  '/test-arena/pyq',
  '/test-arena/subjects',
  '/quiz/instructions',
  '/quiz',
  '/result',
  '/mock',
  '/revision',
  '/materials',
  '/insights',
  '/profile',
] as const
