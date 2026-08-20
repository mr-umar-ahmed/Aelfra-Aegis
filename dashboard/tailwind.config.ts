import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        card: "#1e293b",
        border: "#334155",
        accentRed: "#ef4444",
        accentOrange: "#f97316",
        accentYellow: "#eab308",
        accentCyan: "#06b6d4",
      },
    },
  },
  plugins: [],
};
export default config;
