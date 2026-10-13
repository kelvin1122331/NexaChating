import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366F1',
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        mint: '#10B981',
        canvas: 'hsl(var(--canvas))',
        panel: 'hsl(var(--panel))',
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        line: 'hsl(var(--line))',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(15, 23, 42, 0.08)',
        card: '0 2px 10px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'message-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.65', transform: 'scale(0.96)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s infinite',
        'message-in': 'message-in 180ms ease-out both',
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};

export default config;
