// @ts-nocheck
import { heroui } from "@heroui/react";

const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#020810",
          900: "#050d1a",
          800: "#0a1628",
          700: "#0f1f38",
          600: "#152848",
          500: "#1a3158",
        },
        gold: {
          300: "#fdfbf7",
          400: "#f7f3e5",
          500: "#ede4cc",
          600: "#d4ccae",
        },
      },
      fontFamily: {
        display: ["DM Serif Display", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        "glow-gold": "0 0 12px rgba(247, 243, 229, 0.35), 0 0 28px rgba(247, 243, 229, 0.12)",
        "glow-gold-sm": "0 0 8px rgba(247, 243, 229, 0.25), 0 0 16px rgba(247, 243, 229, 0.08)",
        "glow-gold-lg": "0 0 20px rgba(247, 243, 229, 0.45), 0 0 48px rgba(247, 243, 229, 0.18)",
      },
      borderColor: {
        gold: "rgba(201, 168, 76, 0.3)",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: "#c9a84c",
              foreground: "#050d1a",
            },
            background: "#050d1a",
            foreground: "#e8e8f0",
          },
        },
      },
    }),
  ],
};

export default config;
