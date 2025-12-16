import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
        ],
      },
      colors: {
        // Спокойный холодный акцент (сине-серый)
        accent: {
          50: "#F0F4F8",
          100: "#E8EDF5",
          200: "#D1DBEB",
          300: "#B4C5DB",
          400: "#8FA5C7",
          500: "#5B7FB8",
          600: "#4A6FA5",
          700: "#3A5A8A",
          800: "#2D4870",
          900: "#1F3450"
        },
        // Обратная совместимость (brand -> accent)
        brand: {
          50: "#F0F4F8",
          100: "#E8EDF5",
          200: "#D1DBEB",
          300: "#B4C5DB",
          400: "#8FA5C7",
          500: "#5B7FB8",
          600: "#4A6FA5",
          700: "#3A5A8A",
          800: "#2D4870",
          900: "#1F3450"
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
