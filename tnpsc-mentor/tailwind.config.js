/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Strict TNPSC Mentor palette
        primary: '#0D47A1', // dark navy blue — backgrounds
        secondary: '#1565C0', // cards, panels
        accent: '#FFC107', // active buttons, highlights
        navytext: '#0D1B2A', // text inside yellow buttons
        warn: '#FF5722', // warnings, important notes
      },
      fontFamily: {
        heading: ['Rajdhani', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        tamil: ['"Noto Sans Tamil"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        pill: '0 4px 14px rgba(0,0,0,0.18)',
        card: '0 8px 30px rgba(0,0,0,0.25)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease-out',
        pop: 'pop 0.18s ease-out',
      },
    },
  },
  plugins: [],
}
