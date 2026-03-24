// SalesFlow design tokens — matches web Vercel dark theme
export const colors = {
  bg: '#000000',
  surface: '#0a0a0a',
  elevated: '#111111',
  hover: '#1a1a1a',

  border: '#333333',
  borderSubtle: '#222222',
  borderFaint: '#1a1a1a',

  text: '#ededed',
  textSecondary: '#999999',
  textMuted: '#666666',
  textFaint: '#444444',

  white: '#ffffff',
  black: '#000000',

  blue: '#60a5fa',     // status: new, links
  yellow: '#eab308',   // status: visited
  purple: '#c084fc',   // status: pitched
  green: '#4ade80',    // status: sold, success
  red: '#f87171',      // status: rejected, error

  // Accent
  accent: '#3b82f6',
} as const;

export type ColorName = keyof typeof colors;
