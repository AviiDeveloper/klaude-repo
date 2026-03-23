import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: "#ffffff", alt: "#f8fafc", border: "#e2e8f0" },
        primary: { DEFAULT: "#0f172a", light: "#334155" },
        accent: { DEFAULT: "#2563eb", hover: "#1d4ed8", light: "#dbeafe" },
        muted: { DEFAULT: "#64748b", light: "#94a3b8" },
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
