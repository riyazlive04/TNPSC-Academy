// ─── Server-driven UI: the component registry ────────────────────────────────
// The map from a node's `type` to a real component. This file is the contract:
// a layout can only ever draw what is listed here, using props that are read
// explicitly below. Nothing is spread from the wire onto a DOM element — every
// prop is pulled out by name and coerced — so a published row cannot inject a
// class, a style, an event handler or a URL the app didn't ask for.
//
// Every entry composes the app's OWN primitives (ListRow, CardRow, GridCard,
// IconTile, SectionHeader, ProgressBar). That is deliberate: a server-driven
// banner has to be indistinguishable from a hand-written one, or the screen
// stops looking like one product. Nothing here invents new visual language.

import type { ComponentType, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import SectionHeader from '../UI/SectionHeader'
import IconTile, { type Tint } from '../UI/IconTile'
import ProgressBar from '../UI/ProgressBar'
import { List, ListRow } from '../UI/ListRow'
import { CardGrid, CardList, CardRow, GridCard } from '../UI/CardRow'
import { tapScaleSubtle } from '../../lib/motion'
import { textProp } from '../../lib/sdui/conditions'
import type { SduiContext } from '../../lib/sdui/context'
import type { SduiNode } from '../../lib/sdui/types'
import type { SduiNodeType } from '../../lib/sdui/validate'
import { SDUI_ICONS } from './icons'

/** What every registry entry is handed. `children` is the already-rendered,
 *  already-condition-filtered subtree — a component never evaluates its own
 *  children, so the renderer stays the single place visibility is decided. */
export interface SduiNodeProps {
  node: SduiNode
  ctx: SduiContext
  children: ReactNode
  /** Runs this node's action, if any. Inert when the node has none. */
  onAction: () => void
  /** True when the node declares an action the dispatcher accepted. */
  interactive: boolean
}

// ─── Prop readers ────────────────────────────────────────────────────────────
// Every prop that reaches a component goes through one of these. An absent or
// wrong-typed value falls back to a sane default rather than rendering
// `undefined` into the page.

const TINTS = new Set(['violet', 'coral', 'blue', 'green'])

function tint(props: Record<string, unknown> | undefined, key = 'tint'): Tint {
  const v = props?.[key]
  return typeof v === 'string' && TINTS.has(v) ? (v as Tint) : 'violet'
}

function int(props: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const n = Number(props?.[key])
  return Number.isFinite(n) ? n : fallback
}

function bool(props: Record<string, unknown> | undefined, key: string): boolean {
  return props?.[key] === true
}

/** An icon node → the mapped lucide glyph, or null when unnamed/unknown. */
function icon(props: Record<string, unknown> | undefined, size = 18): ReactNode {
  const name = props?.icon
  if (typeof name !== 'string') return null
  const Glyph = SDUI_ICONS[name]
  return Glyph ? <Glyph size={size} /> : null
}

/**
 * Images are the one place a layout supplies a URL that the browser fetches, so
 * the source is restricted to our own storage/CDN and to data-less https. A
 * rejected src renders nothing rather than a broken-image icon.
 */
function imageSrc(props: Record<string, unknown> | undefined): string | null {
  const v = props?.src
  if (typeof v !== 'string') return null
  // App-relative (public/) assets shipped in the build.
  if (v.startsWith('/') && !v.startsWith('//')) return v
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase()
    const ok = ['tnpscmentors.in', 'supabase.co', 'ytimg.com']
    return ok.some((h) => host === h || host.endsWith(`.${h}`)) ? v : null
  } catch {
    return null
  }
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const GAPS: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-1.5',
  sm: 'gap-2.5',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
}

function gap(props: Record<string, unknown> | undefined): string {
  const v = props?.gap
  return typeof v === 'string' && GAPS[v] ? GAPS[v] : GAPS.md
}

function Stack({ node, children }: SduiNodeProps) {
  return <div className={`flex flex-col ${gap(node.props)}`}>{children}</div>
}

function Row({ node, children }: SduiNodeProps) {
  const align = node.props?.align === 'start' ? 'items-start' : 'items-center'
  const justify = node.props?.justify === 'between' ? 'justify-between' : ''
  return <div className={`flex ${align} ${justify} ${gap(node.props)}`}>{children}</div>
}

function Grid({ node, children }: SduiNodeProps) {
  const cols = Math.min(3, Math.max(1, int(node.props, 'columns', 2)))
  const colCls = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2'
  return <div className={`grid ${colCls} ${gap(node.props)}`}>{children}</div>
}

/** A titled group — the app's standard "label + space" grouping, not a box. */
function Section({ node, ctx, children, onAction, interactive }: SduiNodeProps) {
  const title = textProp(node.props, 'title', ctx)
  const actionLabel = textProp(node.props, 'action_label', ctx)
  return (
    <section className="space-y-3">
      {title && (
        <SectionHeader
          title={title}
          action={
            interactive && actionLabel ? { label: actionLabel, onClick: onAction } : undefined
          }
        />
      )}
      {children}
    </section>
  )
}

function Spacer({ node }: SduiNodeProps) {
  return <div style={{ height: Math.min(64, Math.max(0, int(node.props, 'size', 12))) }} />
}

function Divider() {
  return <hr className="border-0 border-t border-line" />
}

// ─── Content ─────────────────────────────────────────────────────────────────

const TEXT_TONES: Record<string, string> = {
  default: 'text-ink',
  muted: 'text-muted',
  soft: 'text-ink2',
  brand: 'text-brand',
  accent: 'text-accent',
}

const TEXT_SIZES: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

function Text({ node, ctx }: SduiNodeProps) {
  const value = textProp(node.props, 'text', ctx)
  if (!value) return null
  const tone = TEXT_TONES[String(node.props?.tone ?? '')] ?? TEXT_TONES.default
  const size = TEXT_SIZES[String(node.props?.size ?? '')] ?? TEXT_SIZES.sm
  const center = bool(node.props, 'center') ? 'text-center' : ''
  // `tamil` is the app's font-feature class for Tamil copy; harmless on English
  // and required for the bilingual pair to render with the right face.
  return (
    <p className={`tamil font-body leading-relaxed ${size} ${tone} ${center}`}>{value}</p>
  )
}

function Heading({ node, ctx }: SduiNodeProps) {
  const value = textProp(node.props, 'text', ctx)
  if (!value) return null
  const size = node.props?.size === 'lg' ? 'text-xl' : 'text-base'
  return (
    <h2 className={`tamil font-display font-semibold tracking-tight text-ink ${size}`}>{value}</h2>
  )
}

function Image({ node, ctx }: SduiNodeProps) {
  const src = imageSrc(node.props)
  if (!src) return null
  const alt = textProp(node.props, 'alt', ctx)
  const ratio = node.props?.ratio === 'square' ? 'aspect-square' : 'aspect-[16/9]'
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`w-full rounded-card border border-line object-cover ${ratio}`}
    />
  )
}

function Icon({ node }: SduiNodeProps) {
  const glyph = icon(node.props, int(node.props, 'size', 20))
  if (!glyph) return null
  return (
    <IconTile tint={tint(node.props)} size={int(node.props, 'tile', 38)}>
      {glyph}
    </IconTile>
  )
}

function Badge({ node, ctx }: SduiNodeProps) {
  const label = textProp(node.props, 'label', ctx)
  if (!label) return null
  return (
    <span className="tamil inline-flex items-center rounded-full bg-brand-soft px-2.5 py-1 font-body text-2xs font-semibold uppercase tracking-wide text-brand">
      {label}
    </span>
  )
}

/** A single number + caption, matching the dashboard's stat chips. */
function Stat({ node, ctx }: SduiNodeProps) {
  const value = textProp(node.props, 'value', ctx)
  const label = textProp(node.props, 'label', ctx)
  const glyph = icon(node.props, 18)
  return (
    <div className="card flex items-center gap-3 p-3.5">
      {glyph && (
        <IconTile tint={tint(node.props)} size={40}>
          {glyph}
        </IconTile>
      )}
      <div className="min-w-0">
        <div className="font-heading text-xl font-semibold leading-none text-ink">{value}</div>
        {label && (
          <div className="tamil mt-1 truncate font-body text-2xs uppercase tracking-wide text-ink2">
            {label}
          </div>
        )}
      </div>
    </div>
  )
}

function Progress({ node, ctx }: SduiNodeProps) {
  const label = textProp(node.props, 'label', ctx)
  const percent = Math.max(0, Math.min(100, int(node.props, 'percent', 0)))
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="tamil flex items-baseline justify-between font-body text-xs text-muted">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <ProgressBar percent={percent} />
    </div>
  )
}

// ─── Interactive ─────────────────────────────────────────────────────────────

const BUTTON_VARIANTS: Record<string, string> = {
  brand: 'btn-brand',
  accent: 'btn-accent',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
  gold: 'btn-gold',
}

function Button({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const label = textProp(node.props, 'label', ctx)
  if (!label) return null
  const variant = BUTTON_VARIANTS[String(node.props?.variant ?? '')] ?? BUTTON_VARIANTS.brand
  const full = bool(node.props, 'full') ? 'w-full justify-center' : ''
  // btn-wrap, not btn: Tamil runs roughly twice as wide as English and the base
  // .btn is whitespace-nowrap, which overflows a 320px screen (see the Tamil
  // button-overflow note in the design system).
  return (
    <button
      type="button"
      onClick={onAction}
      disabled={!interactive}
      className={`btn-wrap ${variant} ${full} px-5 py-2.5 text-sm disabled:opacity-60`}
    >
      {icon(node.props, 16)}
      {label}
    </button>
  )
}

/** A plain surface to group content on — the only box in the registry. */
function Card({ children, onAction, interactive }: SduiNodeProps) {
  const reduce = useReducedMotion()
  const inner = <div className="space-y-2.5">{children}</div>
  if (!interactive) return <div className="card p-4">{inner}</div>
  return (
    <motion.button
      type="button"
      onClick={onAction}
      whileTap={reduce ? undefined : tapScaleSubtle}
      className="card focus-ring w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand/30"
    >
      {inner}
    </motion.button>
  )
}

function SduiCardRow({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const glyph = icon(node.props, 18)
  return (
    <CardRow
      leading={glyph ? <IconTile tint={tint(node.props)}>{glyph}</IconTile> : undefined}
      title={textProp(node.props, 'title', ctx)}
      subtitle={textProp(node.props, 'subtitle', ctx) || undefined}
      trailing={textProp(node.props, 'value', ctx) || undefined}
      onClick={interactive ? onAction : undefined}
      disabled={!interactive}
    />
  )
}

function SduiGridCard({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const badgeLabel = textProp(node.props, 'badge', ctx)
  return (
    <GridCard
      icon={icon(node.props, 20)}
      tint={tint(node.props)}
      title={textProp(node.props, 'title', ctx)}
      subtitle={textProp(node.props, 'subtitle', ctx) || undefined}
      badge={
        badgeLabel ? (
          <span className="tamil rounded-full bg-brand-soft px-2 py-0.5 font-body text-2xs font-semibold text-brand">
            {badgeLabel}
          </span>
        ) : undefined
      }
      onClick={interactive ? onAction : undefined}
      disabled={!interactive}
    />
  )
}

function SduiListRow({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const glyph = icon(node.props, 18)
  return (
    <ListRow
      leading={glyph ? <IconTile tint={tint(node.props)}>{glyph}</IconTile> : undefined}
      title={textProp(node.props, 'title', ctx)}
      subtitle={textProp(node.props, 'subtitle', ctx) || undefined}
      trailing={textProp(node.props, 'value', ctx) || undefined}
      onClick={interactive ? onAction : undefined}
      disabled={!interactive}
    />
  )
}

/**
 * The discovery banner — the single most-changed surface on the dashboard, and
 * the reason this whole system exists. A tinted panel with copy, an optional
 * price line and one call to action.
 */
function Banner({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const reduce = useReducedMotion()
  const title = textProp(node.props, 'title', ctx)
  const subtitle = textProp(node.props, 'subtitle', ctx)
  const cta = textProp(node.props, 'cta', ctx)
  const glyph = icon(node.props, 20)
  if (!title && !subtitle) return null

  const body = (
    <>
      <div className="flex items-start gap-3">
        {glyph && (
          <IconTile tint={tint(node.props)} size={40}>
            {glyph}
          </IconTile>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <div className="tamil font-display text-base font-semibold leading-snug text-ink">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="tamil mt-1 font-body text-sm leading-relaxed text-muted">{subtitle}</div>
          )}
        </div>
      </div>
      {cta && (
        <span className="tamil mt-3 inline-flex items-center gap-1 font-body text-sm font-semibold text-accent">
          {cta}
        </span>
      )}
    </>
  )

  if (!interactive) return <div className="card p-4">{body}</div>
  return (
    <motion.button
      type="button"
      onClick={onAction}
      whileTap={reduce ? undefined : tapScaleSubtle}
      className="card focus-ring w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand/30"
    >
      {body}
    </motion.button>
  )
}

/** The one elevated element a screen is allowed — the gradient panel the
 *  dashboard already uses for its primary action. */
function Hero({ node, ctx, onAction, interactive }: SduiNodeProps) {
  const reduce = useReducedMotion()
  const title = textProp(node.props, 'title', ctx)
  const subtitle = textProp(node.props, 'subtitle', ctx)
  const cta = textProp(node.props, 'cta', ctx)
  if (!title) return null

  return (
    <motion.div
      whileTap={interactive && !reduce ? tapScaleSubtle : undefined}
      onClick={interactive ? onAction : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onAction()
              }
            }
          : undefined
      }
      className={`hero-panel p-5 ${interactive ? 'focus-ring cursor-pointer' : ''}`}
    >
      <div className="tamil font-display text-lg font-semibold leading-snug text-white">{title}</div>
      {subtitle && (
        <div className="tamil mt-1.5 font-body text-sm leading-relaxed text-white/80">
          {subtitle}
        </div>
      )}
      {cta && (
        <span className="tamil mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 font-body text-sm font-semibold text-white">
          {cta}
          {icon(node.props, 16)}
        </span>
      )}
    </motion.div>
  )
}

/**
 * The container its rows expect. `style` picks which of the app's three row
 * languages this group speaks — hairline-divided list (the default, ~80% of
 * screens), spaced cards, or the two-column tile grid — so a layout groups
 * `list_row` / `card_row` / `grid_card` children the way a hand-written screen
 * would, instead of each row inventing its own spacing.
 */
function SduiList({ node, children }: SduiNodeProps) {
  switch (node.props?.style) {
    case 'card':
      return <CardList>{children}</CardList>
    case 'grid':
      return <CardGrid>{children}</CardGrid>
    default:
      return <List>{children}</List>
  }
}

/**
 * The registry. Typed as a total map over SduiNodeType, so a type added to the
 * schema without a component here (or vice versa) fails the build rather than
 * silently rendering nothing on a student's phone.
 */
export const SDUI_REGISTRY: Record<SduiNodeType, ComponentType<SduiNodeProps>> = {
  stack: Stack,
  row: Row,
  grid: Grid,
  section: Section,
  spacer: Spacer,
  divider: Divider,
  text: Text,
  heading: Heading,
  image: Image,
  icon: Icon,
  badge: Badge,
  stat: Stat,
  progress: Progress,
  button: Button,
  card: Card,
  card_row: SduiCardRow,
  grid_card: SduiGridCard,
  list: SduiList,
  list_row: SduiListRow,
  banner: Banner,
  hero: Hero,
}
