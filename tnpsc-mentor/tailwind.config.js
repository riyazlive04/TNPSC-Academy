/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─── Blue travel-booking palette ───────────────────────────────────
        // A confident royal blue carries the hero surfaces; white cards float on
        // a soft blue-tinted canvas; a warm orange is the single call-to-action
        // accent (used sparingly, the way the inspiration does).
        brand: {
          DEFAULT: '#2563EB', // royal blue — primary actions, active states
          dark: '#1D4ED8',
          deep: '#1E3A8A', // deep navy-blue for hero gradients
          soft: '#EAF1FF', // faint blue wash for chips / icon tiles
          ring: '#BFD3FF',
        },
        canvas: '#F4F7FC', // app background — light blue-gray
        card: '#FFFFFF',
        ink: '#0F1B3D', // primary text — deep navy
        ink2: '#5B6B8C', // secondary text — muted slate-blue
        line: '#E4EAF4', // hairline borders
        tint: '#EEF3FF', // neutral blue fill for icon tiles / chips

        // ─── Warm accent (the orange CTA from the inspiration) ─────────────
        accentwarm: '#FF6B35',
        accentwarmsoft: '#FFEDE4',

        // ─── Semantic accents ──────────────────────────────────────────────
        gold: '#F59E0B',
        goldsoft: '#FEF3E2',
        mint: '#16A34A',
        mintsoft: '#E7F7EE',
        coral: '#EF4444',
        coralsoft: '#FDECEC',
        sky: '#2563EB',
        skysoft: '#EAF1FF',
        streak: '#FF6B35',
        streaksoft: '#FFEDE4',

        // ─── Legacy aliases (remapped onto the blue scheme) ─────────────────
        primary: '#2563EB',
        secondary: '#3B82F6',
        accent: '#FF6B35',
        navytext: '#0F1B3D',
        warn: '#EF4444',
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
        // Restrained, hairline-first elevation — professional, not floaty.
        pill: '0 1px 2px rgba(15,27,61,0.05)',
        card: '0 1px 3px rgba(15,27,61,0.06)',
        soft: '0 1px 2px rgba(15,27,61,0.04)',
        brand: '0 4px 14px rgba(37,99,235,0.18)',
        warm: '0 4px 14px rgba(255,107,53,0.18)',
        gold: '0 4px 14px rgba(245,158,11,0.16)',
      },
      backgroundImage: {
        // A refined, deeper royal-blue → navy hero gradient (less neon).
        'brand-gradient': 'linear-gradient(135deg, #2563EB 0%, #1E40AF 55%, #172554 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
        'brand-radial':
          'radial-gradient(900px 400px at 50% -12%, rgba(37,99,235,0.06), rgba(244,247,252,0) 70%)',
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
      },
    },
  },
  plugins: [],
}
