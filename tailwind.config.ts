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
        "2xl": "1rem"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(0,0,0,0.06)"
      }
    },
  },
  plugins: [],
} satisfies Config;
