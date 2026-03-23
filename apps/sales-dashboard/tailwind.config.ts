import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sd: {
          bg: '#0a0a0f',
          'bg-card': '#141420',
          'bg-elevated': '#1e1e2e',
          border: '#2a2a3d',
          text: '#e4e4ef',
          'text-muted': '#8888a0',
          accent: '#6366f1',
          'accent-light': '#818cf8',
          green: '#22c55e',
          amber: '#f59e0b',
          blue: '#3b82f6',
          red: '#ef4444',
          gold: '#fbbf24',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};

export default config;
