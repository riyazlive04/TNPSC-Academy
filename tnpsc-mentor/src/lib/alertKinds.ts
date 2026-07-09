import { Info, AlertTriangle, Sparkles, PartyPopper, type LucideIcon } from 'lucide-react'
import type { AlertKind } from './api'
import type { StringKey } from './i18n'

// A popup announcement's TYPE, shared by the student popup (AlertPopup) and the
// superadmin composer/history so both render the same icon, colour and label.

export const ALERT_KINDS: AlertKind[] = ['info', 'alert', 'update', 'success']

export interface AlertKindConfig {
  icon: LucideIcon
  labelKey: StringKey
  /** Round icon badge in the popup + list row. */
  badge: string
  /** Small text-only chip (uppercase label). */
  chip: string
}

export const ALERT_KIND: Record<AlertKind, AlertKindConfig> = {
  info: {
    icon: Info,
    labelKey: 'alertKindInfo',
    badge: 'bg-brand-soft text-brand',
    chip: 'bg-brand-soft text-brand',
  },
  alert: {
    icon: AlertTriangle,
    labelKey: 'alertKindAlert',
    badge: 'bg-goldsoft text-gold',
    chip: 'bg-goldsoft text-gold',
  },
  update: {
    icon: Sparkles,
    labelKey: 'alertKindUpdate',
    badge: 'bg-tint-violet text-primary',
    chip: 'bg-tint-violet text-primary',
  },
  success: {
    icon: PartyPopper,
    labelKey: 'alertKindSuccess',
    badge: 'bg-mintsoft text-mint',
    chip: 'bg-mintsoft text-mint',
  },
}

/** Coerce any stored/legacy value to a valid kind ('info' is the neutral default). */
export function alertKindOf(kind: string | null | undefined): AlertKind {
  return kind && (ALERT_KINDS as string[]).includes(kind) ? (kind as AlertKind) : 'info'
}
