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

        // ─── design-system.md spec names (aliases onto the violet scheme) ───
        // New code should prefer these; they map to the same CSS variables so
        // the whole UI re-themes from index.css. Hyphenated/nested keys give
        // `bg-primary`, `bg-primary-deep`, `bg-tint-violet`, etc.
        primary: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          deep: 'rgb(var(--c-brand-deep) / <alpha-value>)',
        },
        surface: 'rgb(var(--c-canvas) / <alpha-value>)',
        muted: 'rgb(var(--c-ink2) / <alpha-value>)',
        correct: 'rgb(var(--c-correct) / <alpha-value>)',
        wrong: 'rgb(var(--c-wrong) / <alpha-value>)',
        selected: 'rgb(var(--c-selected) / <alpha-value>)',
        'tint-violet': 'rgb(var(--c-tint-violet) / <alpha-value>)',
        'tint-coral': 'rgb(var(--c-tint-coral) / <alpha-value>)',
        'tint-blue': 'rgb(var(--c-tint-blue) / <alpha-value>)',
        'tint-green': 'rgb(var(--c-tint-green) / <alpha-value>)',

        // ─── Legacy aliases (remapped onto the violet scheme) ───────────────
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        accent: 'rgb(var(--c-accentwarm) / <alpha-value>)',
        navytext: 'rgb(var(--c-ink) / <alpha-value>)',
        warn: 'rgb(var(--c-coral) / <alpha-value>)',
      },
      fontFamily: {
        // Display = Plus Jakarta Sans (Latin) → Anek Tamil (Tamil). Body = Inter
        // (Latin) → Noto Sans Tamil. The Latin font has no Tamil glyphs, so the
        // browser falls through to the Tamil face automatically.
        display: ['"Plus Jakarta Sans"', '"Anek Tamil"', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Anek Tamil"', 'system-ui', 'sans-serif'],
        body: ['Inter', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
        tamil: ['"Noto Sans Tamil"', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        // design-system.md shape scale
        field: '16px',
        tile: '18px',
        card: '20px',
        hero: '24px',
        pill: '9999px',
        '4xl': '1.75rem',
        '5xl': '2.25rem',
      },
      boxShadow: {
        // Soft, large-blur elevation (design-system.md). Each maps to a CSS
        // variable (defined in index.css) so the whole set can be switched off in
        // dark mode — `.dark` sets them all to `none`, including hover variants,
        // without affecting focus rings (which use the separate `ring` utilities).
        pill: 'var(--shadow-pill)',
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)',
        hero: 'var(--shadow-hero)',
        brand: 'var(--shadow-brand)',
        warm: 'var(--shadow-warm)',
        gold: 'var(--shadow-gold)',
        mint: 'var(--shadow-mint)',
      },
      backgroundImage: {
        // Violet hero gradient — design-system.md: linear-gradient(135deg,#8175EC,#6A5DD6).
        // Variable-backed (secondary → brand-deep) so it stays consistent per mode.
        'brand-gradient':
          'linear-gradient(135deg, rgb(var(--c-secondary)) 0%, rgb(var(--c-brand-deep)) 100%)',
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
        // Left-edge drawer entrance (side-panel nav).
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        // Continuous right-to-left ticker. The track renders its item set TWICE;
        // -50% lands the second copy exactly where the first began, so the loop
        // is seamless. Requires uniform per-item margin (not flex gap), or the
        // final gap is missing and the seam jumps.
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
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
        // Loading-screen logo "breath" (LogoLoader) — a gentle scale + fade.
        logoPulse: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.86)', opacity: '0.75' },
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
        slideInLeft: 'slideInLeft 0.28s cubic-bezier(0.22,1,0.36,1)',
        // Duration is set inline per-track so the pixel speed stays constant
        // regardless of how many cards are in the loop.
        marquee: 'marquee 40s linear infinite',
        toastIn: 'toastIn 0.32s cubic-bezier(0.22,1,0.36,1)',
        pulseRing: 'pulseRing 1.4s ease-out',
        popStar: 'popStar 0.32s cubic-bezier(0.22,1,0.36,1)',
        shake: 'shake 0.4s ease-in-out',
        shimmer: 'shimmer 1.6s linear infinite',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
        checkPop: 'checkPop 0.3s cubic-bezier(0.22,1,0.36,1)',
        breathe: 'breathe 1.05s ease-in-out infinite',
        logoPulse: 'logoPulse 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
