import { useId } from 'react'

export type MascotMood = 'happy' | 'celebrate' | 'think' | 'sad' | 'wave'

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
  /** Gentle idle float. */
  float?: boolean
}

/**
 * "Sipi" - TNPSC Mentors' study-buddy mascot. A friendly purple droplet whose
 * face + arms react to context: celebrating a great score, thinking on a hard
 * question, waving hello on the dashboard, or cheering you on in revision.
 * Pure inline SVG so it scales crisply and ships with zero assets.
 */
export default function Mascot({
  mood = 'happy',
  size = 120,
  className = '',
  float = true,
}: MascotProps) {
  const raw = useId().replace(/:/g, '')
  const bodyGrad = `bg${raw}`

  // Eye pupils shift up when "thinking".
  const pupilDy = mood === 'think' ? -3 : 1
  const pupilDx = mood === 'think' ? 2 : 0

  // Arm positions per mood (cx, cy, rotation°).
  const leftArm = mood === 'celebrate' ? { x: 24, y: 60, r: -28 } : { x: 22, y: 92, r: -18 }
  const rightArm =
    mood === 'celebrate' || mood === 'wave'
      ? { x: 98, y: 58, r: 30 }
      : { x: 98, y: 92, r: 18 }

  return (
    <svg
      viewBox="0 0 120 132"
      width={size}
      height={(size * 132) / 120}
      className={[float ? 'animate-floaty' : '', className].join(' ')}
      role="img"
      aria-label="TNPSC Mentors mascot"
    >
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B7BF5" />
          <stop offset="60%" stopColor="#6C5CE7" />
          <stop offset="100%" stopColor="#5B4BD6" />
        </linearGradient>
      </defs>

      {/* Sparkles when celebrating */}
      {mood === 'celebrate' && (
        <g fill="#FFB020">
          <Star x={16} y={28} s={6} />
          <Star x={104} y={24} s={5} />
          <Star x={100} y={74} s={4} />
        </g>
      )}

      {/* Feet */}
      <ellipse cx="48" cy="123" rx="9" ry="5" fill="#5B4BD6" />
      <ellipse cx="72" cy="123" rx="9" ry="5" fill="#5B4BD6" />

      {/* Arms */}
      <ellipse
        cx={leftArm.x}
        cy={leftArm.y}
        rx="7"
        ry="11"
        fill="#5B4BD6"
        transform={`rotate(${leftArm.r} ${leftArm.x} ${leftArm.y})`}
      />
      <ellipse
        cx={rightArm.x}
        cy={rightArm.y}
        rx="7"
        ry="11"
        fill="#5B4BD6"
        transform={`rotate(${rightArm.r} ${rightArm.x} ${rightArm.y})`}
      />

      {/* Body (teardrop) */}
      <path
        d="M60 16 C 82 40 96 60 96 80 C 96 103 80 118 60 118 C 40 118 24 103 24 80 C 24 60 38 40 60 16 Z"
        fill={`url(#${bodyGrad})`}
      />
      {/* Shine */}
      <ellipse cx="46" cy="52" rx="9" ry="13" fill="#FFFFFF" opacity="0.18" transform="rotate(-18 46 52)" />

      {/* Cheeks */}
      <ellipse cx="39" cy="92" rx="7" ry="4.5" fill="#FF8FB0" opacity="0.55" />
      <ellipse cx="81" cy="92" rx="7" ry="4.5" fill="#FF8FB0" opacity="0.55" />

      {/* Eyes */}
      <ellipse cx="50" cy="76" rx="8" ry="10" fill="#FFFFFF" />
      <ellipse cx="70" cy="76" rx="8" ry="10" fill="#FFFFFF" />
      <circle cx={50 + pupilDx} cy={77 + pupilDy} r="4" fill="#1E1B3A" />
      <circle cx={70 + pupilDx} cy={77 + pupilDy} r="4" fill="#1E1B3A" />
      <circle cx={51.6 + pupilDx} cy={75.5 + pupilDy} r="1.4" fill="#FFFFFF" />
      <circle cx={71.6 + pupilDx} cy={75.5 + pupilDy} r="1.4" fill="#FFFFFF" />

      {/* Mouth */}
      {mood === 'celebrate' ? (
        <path d="M52 92 Q60 108 68 92 Z" fill="#3A2E66" />
      ) : mood === 'think' ? (
        <circle cx="60" cy="97" r="3.2" fill="#3A2E66" />
      ) : mood === 'sad' ? (
        <path
          d="M52 101 Q60 93 68 101"
          fill="none"
          stroke="#3A2E66"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M51 94 Q60 104 69 94"
          fill="none"
          stroke="#3A2E66"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

function Star({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s / 5})`}
      d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z"
    />
  )
}
