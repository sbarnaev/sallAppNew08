import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#ebefff",
          200: "#d7deff",
          300: "#b3c1ff",
          400: "#7f93ff",
          500: "#4a61ff",
          600: "#2c42e6",
          700: "#2034b4",
          800: "#1c2d8f",
          900: "#1a2a75"
        }
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem"
      },
      boxShadow: {
        soft: "0 2px 8px rgba(0,0,0,0.04)",
        "soft-lg": "0 8px 24px rgba(0,0,0,0.08)",
        "premium": "0 4px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)",
        "premium-lg": "0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)"
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem"
      }
    },
  },
  plugins: [],
} satisfies Config;
