import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#090E1A",
        surface: "#0D1322",
        card: "#111827",
        borderline: "#1E293B",
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
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
