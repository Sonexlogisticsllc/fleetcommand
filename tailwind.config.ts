import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Base Navy (global) ─────────────────────────
        navy: {
          DEFAULT: '#050B18',
          light: '#0A1628',
          panel: '#0D1F3C',
          border: '#1A2F4A',
          hover: '#112240',
        },
        // ─── Dispatcher — Electric Blue / Cyan ──────────
        blue: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
          light: '#60A5FA',
          glow: 'rgba(59, 130, 246, 0.2)',
          panel: '#0A1525',
          border: '#1A3A6A',
          hover: '#0F2040',
        },
        cyan: {
          DEFAULT: '#06B6D4',
          dark: '#0891B2',
          light: '#67E8F9',
          glow: 'rgba(6, 182, 212, 0.2)',
        },
        // ─── Owner — Emerald / Teal ──────────────────────
        emerald: {
          DEFAULT: '#10B981',
          dark: '#059669',
          light: '#34D399',
          glow: 'rgba(16, 185, 129, 0.2)',
          panel: '#071A12',
          border: '#1A4A35',
          hover: '#0A2A1E',
        },
        teal: {
          DEFAULT: '#14B8A6',
          dark: '#0D9488',
          light: '#5EEAD4',
          glow: 'rgba(20, 184, 166, 0.2)',
        },
        // ─── Sales — Violet / Pink ────────────────────────
        violet: {
          DEFAULT: '#8B5CF6',
          dark: '#7C3AED',
          light: '#A78BFA',
          glow: 'rgba(139, 92, 246, 0.2)',
          panel: '#100820',
          border: '#3A1F6A',
          hover: '#1A1030',
        },
        pink: {
          DEFAULT: '#EC4899',
          dark: '#DB2777',
          light: '#F9A8D4',
          glow: 'rgba(236, 72, 153, 0.2)',
        },
        fuchsia: {
          DEFAULT: '#D946EF',
          light: '#E879F9',
          glow: 'rgba(217, 70, 239, 0.15)',
        },
        // ─── Legacy amber (dispatcher accent) ────────────
        amber: {
          DEFAULT: '#FF6B35',
          dark: '#E55A22',
          light: '#FF9A5C',
          glow: 'rgba(255, 107, 53, 0.25)',
        },
        // ─── Semantic ─────────────────────────────────────
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
        slate: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'grid-dark': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.025'%3E%3Cpath d='M0 0h40v1H0zm0 39h40v1H0zM0 0v40H1V0zm39 0v40h1V0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'grid-navy': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M0 0h40v1H0zm0 39h40v1H0zM0 0v40H1V0zm39 0v40h1V0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'gradient-dispatcher': 'linear-gradient(135deg, #050B18 0%, #0A1525 50%, #050B18 100%)',
        'gradient-owner': 'linear-gradient(135deg, #050B18 0%, #071A12 50%, #050B18 100%)',
        'gradient-sales': 'linear-gradient(135deg, #050B18 0%, #100820 50%, #050B18 100%)',
        'gradient-hero': 'linear-gradient(135deg, #050B18 0%, #0A0F20 40%, #0D0525 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scan': 'scan 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out infinite 2s',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 6s ease infinite',
        'call-ring': 'callRing 1.5s ease-in-out infinite',
        'waveform': 'waveform 0.8s ease-in-out infinite alternate',
        'typing': 'typing 1s ease-in-out infinite',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        callRing: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.3)', opacity: '0.3' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        waveform: {
          '0%': { height: '4px' },
          '100%': { height: '24px' },
        },
        typing: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      boxShadow: {
        'amber-glow': '0 8px 32px rgba(255, 107, 53, 0.3)',
        'amber-glow-lg': '0 16px 48px rgba(255, 107, 53, 0.45)',
        'blue-glow': '0 0 20px rgba(59, 130, 246, 0.4)',
        'blue-glow-lg': '0 0 40px rgba(59, 130, 246, 0.5)',
        'cyan-glow': '0 0 20px rgba(6, 182, 212, 0.4)',
        'emerald-glow': '0 0 20px rgba(16, 185, 129, 0.4)',
        'emerald-glow-lg': '0 0 40px rgba(16, 185, 129, 0.5)',
        'teal-glow': '0 0 20px rgba(20, 184, 166, 0.4)',
        'violet-glow': '0 0 20px rgba(139, 92, 246, 0.4)',
        'violet-glow-lg': '0 0 40px rgba(139, 92, 246, 0.5)',
        'pink-glow': '0 0 20px rgba(236, 72, 153, 0.4)',
        'navy-lg': '0 20px 60px rgba(0, 0, 0, 0.6)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
