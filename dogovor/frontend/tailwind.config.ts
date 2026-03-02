import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        medical: {
          blue: "#007AFF",
          blueLight: "#E8F2FF",
        },
      },
      fontSize: {
        base: ["18px", { lineHeight: "1.6" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
