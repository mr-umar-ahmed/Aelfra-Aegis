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
        ocean: "#4E635E",
        villa: "#E2E0C8",
        siren: "#A6B49E",
        river: "#818C78",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
