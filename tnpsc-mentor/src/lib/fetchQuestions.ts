import { supabase } from './supabase'
import type { Question, QuizConfig } from '../types'

export const MAX_QUESTIONS = 100

/** Fisher–Yates shuffle (non-mutating). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Builds and runs the Supabase query for a given quiz config. Returns up to
 * MAX_QUESTIONS questions. The caller decides whether to randomise order
 * (quiz) or keep stable order (admin list).
 */
export async function fetchQuestionsForConfig(
  config: QuizConfig
): Promise<Question[]> {
  let query = supabase.from('questions').select('*').eq('category', config.category)

  switch (config.category) {
    case 'pyq':
      if (config.group_type) query = query.eq('group_type', config.group_type)
      if (config.subject) query = query.eq('subject', config.subject)
      break
    case 'samacheer':
      if (config.subject) query = query.eq('subject', config.subject)
      if (config.standard != null) query = query.eq('standard', config.standard)
      if (config.topic) query = query.eq('topic', config.topic)
      break
    case 'current_affairs':
      if (config.ca_type) query = query.eq('ca_type', config.ca_type)
      if (config.ca_month) query = query.eq('ca_month', config.ca_month)
      if (config.ca_topic) query = query.eq('ca_topic', config.ca_topic)
      break
    case 'aptitude':
      if (config.aptitude_type) query = query.eq('aptitude_type', config.aptitude_type)
      if (config.aptitude_topic) query = query.eq('aptitude_topic', config.aptitude_topic)
      break
  }

  const { data, error } = await query.limit(MAX_QUESTIONS)
  if (error) throw error
  return (data ?? []) as Question[]
}

/** Build a readable label from a config when none was supplied. */
export function describeConfig(config: QuizConfig): string {
  if (config.label) return config.label
  const parts: string[] = [config.category.toUpperCase()]
  if (config.group_type) parts.push(config.group_type)
  if (config.subject) parts.push(config.subject)
  if (config.standard != null) parts.push(`${config.standard}th`)
  if (config.topic) parts.push(config.topic)
  if (config.ca_month) parts.push(config.ca_month)
  if (config.ca_topic) parts.push(config.ca_topic)
  if (config.aptitude_type) parts.push(config.aptitude_type)
  if (config.aptitude_topic) parts.push(config.aptitude_topic)
  return parts.join(' · ')
}
