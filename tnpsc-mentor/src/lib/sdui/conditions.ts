// ─── Server-driven UI: condition evaluation + text resolution ────────────────
// Pure functions over the context (context.ts) — no stores, no React, no eval.
// A `when` clause is data walked by a switch; there is no expression language
// to escape from, which is the whole reason the schema looks the way it does.

import { compareVersions } from '../appUpdate'
import type { SduiContext } from './context'
import type { SduiText, SduiWhen } from './types'

/**
 * Does this node's audience rule match? An absent or malformed rule is `true`:
 * content must never disappear because a condition was written wrong — a banner
 * that shows too widely is a copy problem, one that silently shows to nobody is
 * a support ticket nobody can reproduce.
 */
export function matches(when: SduiWhen | undefined, ctx: SduiContext): boolean {
  if (!when) return true

  // Combinators. `all` and `any` may appear alongside a leaf test, in which
  // case every part must hold (an implicit AND) — that keeps the common
  // "premium users, but only on Android" case a single flat object.
  if (when.all && !when.all.every((c) => matches(c, ctx))) return false
  if (when.any && when.any.length && !when.any.some((c) => matches(c, ctx))) return false
  if (when.not && matches(when.not, ctx)) return false

  if (!when.field) return true

  const actual = (ctx as unknown as Record<string, unknown>)[when.field]
  const expected = when.value

  switch (when.op ?? 'truthy') {
    case 'truthy':
      return Boolean(actual)
    case 'falsy':
      return !actual
    case 'eq':
      return actual === expected
    case 'ne':
      return actual !== expected
    case 'lt':
      return num(actual) < num(expected)
    case 'lte':
      return num(actual) <= num(expected)
    case 'gt':
      return num(actual) > num(expected)
    case 'gte':
      return num(actual) >= num(expected)
    case 'in':
      return Array.isArray(expected) && expected.some((v) => v === actual)
    case 'nin':
      return !Array.isArray(expected) || !expected.some((v) => v === actual)
    // Dotted-version comparisons, so "2.0.10" sorts above "2.0.9" instead of
    // below it the way a string compare would. An empty app_version (the web
    // build) never matches: a native version window is meaningless there.
    case 'version_gte':
      return Boolean(actual) && compareVersions(String(actual), String(expected)) >= 0
    case 'version_lt':
      return Boolean(actual) && compareVersions(String(actual), String(expected)) < 0
    default:
      return true
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Resolve a bilingual string for the reader's language, mirroring the app's own
 * i18n rules: 'both' shows "English / தமிழ்", and a missing Tamil translation
 * falls back to English rather than showing an empty line — an untranslated
 * banner is still a readable banner.
 */
export function resolveText(text: SduiText | undefined, ctx: SduiContext): string {
  if (text === undefined || text === null) return ''
  if (typeof text === 'string') return interpolate(text, ctx)

  const en = interpolate(text.en ?? '', ctx)
  const ta = interpolate(text.ta ?? '', ctx)

  if (ctx.lang === 'ta') return ta || en
  if (ctx.lang === 'both') return ta && ta !== en ? `${en} / ${ta}` : en
  return en
}

/**
 * The only templating a layout gets: `{name}` for the reader's first name and
 * `{credits}` for their balance. Deliberately two tokens rather than a general
 * binding language — everything else a banner needs to say, an author can type.
 * An unknown token is left as-is so a typo is visible in review, not blank.
 */
function interpolate(s: string, ctx: SduiContext): string {
  if (!s.includes('{')) return s
  return s
    .replace(/\{name\}/g, ctx.name)
    .replace(/\{credits\}/g, String(ctx.credits))
    .trim()
}

/** Read a node prop as text (string or bilingual pair), resolved for the reader. */
export function textProp(
  props: Record<string, unknown> | undefined,
  key: string,
  ctx: SduiContext
): string {
  const v = props?.[key]
  if (typeof v === 'string') return resolveText(v, ctx)
  if (v && typeof v === 'object' && 'en' in (v as object)) {
    return resolveText(v as SduiText, ctx)
  }
  return ''
}
