/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ─── Violet design system (light + dark) ───────────────────────────
        // Every colour is a CSS variable defined in index.css (:root for light,
        // .dark for dark mode), so the whole UI re-themes from one place. The
        // channel-triplet form `rgb(var(--x) / <alpha-value>)` keeps Tailwind's
        // /opacity modifiers working, e.g. `bg-brand/30`, `text-ink2/60`.
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          dark: 'rgb(var(--c-brand-dark) / <alpha-value>)',
          deep: 'rgb(var(--c-brand-deep) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
          ring: 'rgb(var(--c-brand-ring) / <alpha-value>)',
        },
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        ink2: 'rgb(var(--c-ink2) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        tint: 'rgb(var(--c-tint) / <alpha-value>)',

        accentwarm: 'rgb(var(--c-accentwarm) / <alpha-value>)',
        accentwarmsoft: 'rgb(var(--c-accentwarm-soft) / <alpha-value>)',

        gold: 'rgb(var(--c-gold) / <alpha-value>)',
        goldsoft: 'rgb(var(--c-gold-soft) / <alpha-value>)',
        mint: 'rgb(var(--c-mint) / <alpha-value>)',
        mintsoft: 'rgb(var(--c-mint-soft) / <alpha-value>)',
        coral: 'rgb(var(--c-coral) / <alpha-value>)',
        coralsoft: 'rgb(var(--c-coral-soft) / <alpha-value>)',
        sky: 'rgb(var(--c-sky) / <alpha-value>)',
        skysoft: 'rgb(var(--c-sky-soft) / <alpha-value>)',
        streak: 'rgb(var(--c-streak) / <alpha-value>)',
        streaksoft: 'rgb(var(--c-streak-soft) / <alpha-value>)',

        // ─── Legacy aliases (remapped onto the violet scheme) ───────────────
        primary: 'rgb(var(--c-brand) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        accent: 'rgb(var(--c-accentwarm) / <alpha-value>)',
        navytext: 'rgb(var(--c-ink) / <alpha-value>)',
        warn: 'rgb(var(--c-coral) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        tamil: ['"Noto Sans Tamil"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '1.75rem',
        '5xl': '2.25rem',
      },
      boxShadow: {
        // Restrained, hairline-first elevation. The neutral shadows fade on the
        // dark canvas (where the card border carries elevation); the brand glow
        // tracks the violet accent in both modes.
        pill: '0 1px 2px rgb(var(--c-shadow) / 0.05)',
        card: '0 1px 3px rgb(var(--c-shadow) / 0.07)',
        soft: '0 1px 2px rgb(var(--c-shadow) / 0.05)',
        brand: '0 8px 22px rgb(var(--c-brand) / 0.32)',
        warm: '0 4px 14px rgb(var(--c-accentwarm) / 0.22)',
        gold: '0 4px 14px rgb(var(--c-gold) / 0.18)',
      },
      backgroundImage: {
        // Violet → deep-violet hero gradient (variable-backed, themes per mode).
        'brand-gradient':
          'linear-gradient(135deg, rgb(var(--c-brand)) 0%, rgb(var(--c-brand-dark)) 55%, rgb(var(--c-brand-deep)) 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgb(var(--c-secondary)) 0%, rgb(var(--c-brand)) 100%)',
        'brand-radial':
          'radial-gradient(900px 400px at 50% -12%, rgb(var(--c-brand) / 0.07), transparent 70%)',
        'hero-grid':
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // ─── Micro-interaction keyframes ───────────────────────────────────
        fadeInFast: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Modal/sheet entrance — slightly springy.
        sheetIn: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '60%': { opacity: '1', transform: 'translateY(-2px) scale(1.01)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Button success / attention pulse.
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.45)' },
          '70%': { boxShadow: '0 0 0 10px rgba(37,99,235,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0)' },
        },
        // Star / icon celebration.
        popStar: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.18)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Gentle horizontal nudge for invalid inputs.
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-4px)' },
          '40%,80%': { transform: 'translateX(4px)' },
        },
        // Indeterminate progress sweep + skeleton shimmer.
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        indeterminate: {
          '0%': { transform: 'translateX(-100%) scaleX(0.4)' },
          '50%': { transform: 'translateX(20%) scaleX(0.6)' },
          '100%': { transform: 'translateX(180%) scaleX(0.4)' },
        },
        checkPop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        // Final-seconds "breathing" pulse for the countdown timer — a slow
        // scale + expanding red halo that reads as urgency without flickering.
        breathe: {
          '0%,100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '50%': { transform: 'scale(1.07)', boxShadow: '0 0 0 9px rgba(239,68,68,0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease-out',
        fadeInFast: 'fadeInFast 0.2s ease-out',
        pop: 'pop 0.16s ease-out',
        floaty: 'floaty 5s ease-in-out infinite',
        slideUp: 'slideUp 0.4s cubic-bezier(0.22,1,0.36,1)',
        slideDown: 'slideDown 0.3s cubic-bezier(0.22,1,0.36,1)',
        scaleIn: 'scaleIn 0.18s ease-out',
        sheetIn: 'sheetIn 0.32s cubic-bezier(0.22,1,0.36,1)',
        toastIn: 'toastIn 0.32s cubic-bezier(0.22,1,0.36,1)',
        pulseRing: 'pulseRing 1.4s ease-out',
        popStar: 'popStar 0.32s cubic-bezier(0.22,1,0.36,1)',
        shake: 'shake 0.4s ease-in-out',
        shimmer: 'shimmer 1.6s linear infinite',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
        checkPop: 'checkPop 0.3s cubic-bezier(0.22,1,0.36,1)',
        breathe: 'breathe 1.05s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
