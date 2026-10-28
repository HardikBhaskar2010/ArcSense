/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#000000',
          900: '#09090b',
          850: '#121214',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
          500: '#71717a',
          400: '#a1a1aa',
          300: '#d4d4d8',
          200: '#e4e4e7',
          100: '#ffffff',
        },
        status: {
          normal: '#10b981',
          watch: '#f59e0b',
          warning: '#f97316',
          danger: '#ef4444',
          trip: '#dc2626',
        },
        wave: {
          current: '#ffffff',
          reference: '#52525b',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', '"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-danger': '0 0 25px -5px rgba(239, 68, 68, 0.45)',
        'glow-warning': '0 0 20px -5px rgba(249, 115, 22, 0.35)',
        'glow-watch': '0 0 15px -5px rgba(245, 158, 11, 0.25)',
        'glow-normal': '0 0 15px -5px rgba(16, 185, 129, 0.25)',
        'glow-white': '0 0 15px -3px rgba(255, 255, 255, 0.25)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'trip-flash': 'tripFlash 1s ease-in-out infinite',
      },
      keyframes: {
        tripFlash: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.005)' },
        }
      }
    },
  },
  plugins: [],
}
