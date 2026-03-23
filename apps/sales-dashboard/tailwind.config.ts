import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial palette — neutral, professional, restrained
        primary: '#111111',
        secondary: '#555555',
        muted: '#888888',
        faint: '#aaaaaa',
        border: '#e5e5e5',
        'border-light': '#f0f0f0',
        surface: '#fafafa',
        card: '#ffffff',
        accent: '#1a1a1a',

        // Functional — used sparingly, only for status
        status: {
          new: '#2563eb',
          visited: '#d97706',
          pitched: '#7c3aed',
          sold: '#16a34a',
          rejected: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};

export default config;
