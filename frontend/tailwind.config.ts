import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        card: "var(--card)",
        cardhover: "var(--cardhover)",
        borderline: "var(--borderline)",
        cardborder: "var(--cardborder)",
        cyan: {
          DEFAULT: "#38BDF8",
          glow: "rgba(56, 189, 248, 0.15)",
        },
        indigo: {
          DEFAULT: "#818CF8",
          subtle: "rgba(129, 140, 248, 0.12)",
        },
        emerald: {
          DEFAULT: "#34D399",
          subtle: "rgba(52, 211, 153, 0.12)",
        },
        amber: {
          DEFAULT: "#FBBF24",
          subtle: "rgba(251, 191, 36, 0.12)",
        },
      },
      boxShadow: {
        highlight: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        glow: "0 0 20px rgba(56, 189, 248, 0.15)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
