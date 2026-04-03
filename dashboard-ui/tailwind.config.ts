import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#22223B",
        secondary: "#4A4E69",
        accent: "#C9ADA7",
        text: "#F2E9E4",
        // Shadcn/ui compatible palette
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },
      backgroundColor: {
        dark: "#22223B",
        muted: "#4A4E69",
        accent: "#C9ADA7",
      },
      textColor: {
        light: "#F2E9E4",
      },
    },
  },
  plugins: [],
};

export default config;
