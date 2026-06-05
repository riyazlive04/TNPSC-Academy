import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, GraduationCap, Newspaper, Calculator, ShieldCheck } from 'lucide-react'
import AppLayout from '../components/Layout/AppLayout'
import YellowBadge from '../components/UI/YellowBadge'
import { useAuth } from '../hooks/useAuth'

interface ArenaCard {
  to: string
  title: string
  icon: React.ReactNode
  /** preview lines shown in the hover tooltip */
  preview: string[]
}

const CARDS: ArenaCard[] = [
  {
    to: '/test-arena/pyq',
    title: 'PREVIOUS YEAR QUESTION PAPERS',
    icon: <BookOpen size={32} />,
    preview: ['Group 1', 'Group 2 / 2A', 'Group 4 & VAO', '10 subjects each'],
  },
  {
    to: '/test-arena/samacheer',
    title: 'SAMACHEER BASED',
    icon: <GraduationCap size={32} />,
    preview: ['Subject → Standard', '6th · 7th · 8th · 9th · 10th', 'Topic-wise tests'],
  },
  {
    to: '/test-arena/current-affairs',
    title: 'CURRENT AFFAIRS',
    icon: <Newspaper size={32} />,
    preview: ['Month Wise (Aug 2025 – Jun 2026)', 'Topic Wise', 'Updated monthly'],
  },
  {
    to: '/test-arena/aptitude',
    title: 'APTITUDE TOPIC WISE',
    icon: <Calculator size={32} />,
    preview: ['Numerics — 12 topics', 'Reasoning — 8 topics'],
  },
]

export default function TestArenaPage() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <YellowBadge>Test Arena</YellowBadge>
          <p className="font-body text-sm text-white/60">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}. Choose a
            category to begin.
          </p>
        </div>

        {isAdmin && (
          <div className="mx-auto mb-6 mt-4 flex max-w-xl items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-center">
            <ShieldCheck size={18} className="text-accent" />
            <p className="font-body text-sm text-white/80">
              <span className="font-semibold text-accent">Admin mode:</span> picking
              any category shows the full question bank (with answers) instead of a
              timed test.
            </p>
          </div>
        )}

        {/* Hover note from the design reference */}
        <p className="mb-6 mt-6 text-center font-heading text-xs uppercase tracking-widest text-white/40">
          Hover a category to preview what's inside
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {CARDS.map((card) => (
            <div
              key={card.to}
              className="relative"
              onMouseEnter={() => setHovered(card.to)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                onClick={() => navigate(card.to)}
                className="flex w-full items-center gap-4 rounded-3xl bg-white px-6 py-6 text-left shadow-pill transition-all duration-200 hover:-translate-y-1 hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {card.icon}
                </span>
                <span className="font-heading text-lg font-bold leading-tight text-navytext">
                  {card.title}
                </span>
              </button>

              {/* Hover preview tooltip */}
              {hovered === card.to && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 animate-pop rounded-2xl bg-navytext p-4 text-left shadow-card">
                  <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-navytext" />
                  <p className="mb-2 font-heading text-xs font-bold uppercase tracking-wide text-accent">
                    Inside this section
                  </p>
                  <ul className="flex flex-col gap-1">
                    {card.preview.map((line) => (
                      <li
                        key={line}
                        className="flex items-center gap-2 font-body text-sm text-white/85"
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
