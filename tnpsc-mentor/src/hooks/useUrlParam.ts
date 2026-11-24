import { useSearchParams } from 'react-router-dom'

/**
 * A picker step kept in the URL query (?key=value) instead of component state,
 * so browser back/forward, Android's back button, breadcrumbs and shared links
 * all land on the same step. `set(null)` removes it. Each set pushes a history
 * entry. Callers validate the raw value — it comes from the address bar.
 */
export function useUrlParam(key: string): [string | null, (value: string | null) => void] {
  const [params, setParams] = useSearchParams()
  const set = (value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  return [params.get(key), set]
}
