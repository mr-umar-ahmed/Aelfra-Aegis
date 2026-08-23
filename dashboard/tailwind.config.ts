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
        ocean: "#09090b",
        "ocean-card": "#121215",
        villa: "#ffffff",
        siren: "#ef4444",
        river: "#27272a",
        "river-light": "#3f3f46",
        cyan: {
          400: "#38bdf8",
          500: "#06b6d4",
        },
        orange: {
          500: "#ff6b00",
          600: "#ea580c",
        },
      },
      fontFamily: {
        cyber: ["Orbitron", "sans-serif"],
        tech: ["Chakra Petch", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      letterSpacing: {
        heading: "-0.03em",
        label: "0.08em",
      },
    },
  },
  plugins: [],
};
export default config;
