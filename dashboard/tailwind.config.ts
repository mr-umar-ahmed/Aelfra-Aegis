import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: "#090d16",
        "ocean-card": "#111827",
        villa: "#f8fafc",
        siren: "#ef4444",
        river: "#1e293b",
        "river-light": "#334155",
        cyan: {
          400: "#38bdf8",
          500: "#06b6d4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Fira Code", "JetBrains Mono", "monospace"],
      },
      letterSpacing: {
        heading: "-0.02em",
        label: "0.05em",
      },
    },
  },
  plugins: [],
};
export default config;
