import { Skeleton } from './Skeleton'
import { useT } from '../../lib/i18n'

/**
 * The exam-year chip row shared by the PYQ group and section screens ("All
 * Years" + one chip per year in the bank). Both screens scope their counts and
 * every test they start to the selected year, so the filter has to look and
 * behave identically on each — hence one component rather than a copy per page.
 *
 * `years` is null while the list is still being fetched (see usePyqYears) and
 * renders as placeholder pills, so the row doesn't pop in and shove the cards
 * below it down the page.
 */
export function YearFilter({
  years,
  value,
  onChange,
  className = 'mb-5',
}: {
  years: number[] | null
  value: number | null
  onChange: (year: number | null) => void
  className?: string
}) {
  const { t } = useT()

  // A bank with no years at all (nothing imported yet) has nothing to filter.
  if (years && years.length === 0) return null

  return (
    <div className={className}>
      <p className="tamil mb-2 font-heading text-[11px] font-bold uppercase tracking-wide text-muted">
        {t('filterByYear')}
      </p>
      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {years === null ? (
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[30px] w-[68px] rounded-full" />
          ))
        ) : (
          <>
            <YearChip label={t('allYears')} active={value === null} onClick={() => onChange(null)} />
            {years.map((y) => (
              <YearChip key={y} label={String(y)} active={value === y} onClick={() => onChange(y)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Read the `?year=` param against the years the bank actually holds. A year the
 * bank doesn't have — a stale link, a hand-typed year, junk — reads as "All
 * Years" rather than filtering the page down to an empty bank.
 *
 * Pass null for `years` while the list is still loading: a plausible year is
 * trusted for that first render (so a deep link isn't dropped) and re-checked
 * against the real list once it arrives.
 */
export function parseYearParam(raw: string | null, years: number[] | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1900 || n > 2200) return null
  if (years && !years.includes(n)) return null
  return n
}

/** Append the selected year to an in-app path, omitting it for "All Years". */
export function withYear(path: string, year: number | null): string {
  return year ? `${path}?year=${year}` : path
}

function YearChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-full px-3.5 py-1.5 font-heading text-[13px] font-semibold tabular-nums transition-colors ${
        active ? 'bg-primary text-white' : 'bg-tint-violet text-primary hover:bg-primary/15'
      }`}
    >
      {label}
    </button>
  )
}
