import {
  Flag,
  BookOpen,
  Target,
  GraduationCap,
  Zap,
  Crown,
  Flame,
  Brain,
  Sparkles,
  Trophy,
  Clock,
} from 'lucide-react'
import type { BadgeIconKey } from '../lib/achievements'

const MAP: Record<BadgeIconKey, typeof Flag> = {
  flag: Flag,
  book: BookOpen,
  target: Target,
  cap: GraduationCap,
  zap: Zap,
  crown: Crown,
  flame: Flame,
  brain: Brain,
  sparkles: Sparkles,
  trophy: Trophy,
  clock: Clock,
}

/** Render the lucide icon for a badge icon key. */
export function badgeIcon(key: BadgeIconKey, size = 22) {
  const Icon = MAP[key] ?? Flag
  return <Icon size={size} />
}
