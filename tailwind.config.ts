import type { Config } from "tailwindcss";

// ── Design system ────────────────────────────────────────────
// One accent per state: income = green, expense = red, neutral = indigo.
// Dark surface scale for the app; light surface for LIFF.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: {
          DEFAULT: "#13131f",
          raised: "#1a1a2e",
        },
        ink: {
          DEFAULT: "#e8e8f0",
          muted: "#9ca3af",
          faint: "#6b7280",
          ghost: "#4b5563",
        },
        line: "rgba(255,255,255,0.07)",
        income: "#10b981",
        expense: "#ef4444",
        accent: {
          DEFAULT: "#6366f1",
          soft: "#a5b4fc",
          from: "#6366f1",
          to: "#8b5cf6",
        },
        warn: "#f59e0b",
      },
      fontFamily: {
        sans: ["'IBM Plex Sans Thai'", "Sarabun", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        pill: "20px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "slide-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s cubic-bezier(0.32,0.72,0,1)",
      },
    },
  },
  plugins: [],
};

export default config;
