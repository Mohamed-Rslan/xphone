/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#7c6bff',
          50:  '#f0eeff',
          100: '#e3deff',
          200: '#c9c0ff',
          300: '#a898ff',
          400: '#8a78ff',
          500: '#7c6bff',
          600: '#6655e8',
          700: '#5242c4',
          800: '#3e309e',
          900: '#2c207a',
        },
        accent: {
          DEFAULT: '#00d4aa',
          400: '#00efc0',
          500: '#00d4aa',
          600: '#00b08c',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          hover: 'rgba(255,255,255,0.08)',
          active: 'rgba(255,255,255,0.12)',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'count-up': 'countUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideInRight: { from: { transform: 'translateX(20px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        slideInLeft: { from: { transform: 'translateX(-20px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        slideUp: { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(124,107,255,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(124,107,255,0.6)' },
        },
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
}
