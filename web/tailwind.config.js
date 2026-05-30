/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0A0B0F",
        panel: "#111218",
        panel2: "#15171F",
        border: "#1F222C",
        borderSoft: "#1A1C24",
        fg: "#E6E8EE",
        muted: "#8A8FA0",
        mutedSoft: "#5C6072",
        accent: {
          bronze: "#C38B5F",
          silver: "#B7C2D0",
          gold: "#E6C76A",
          model: "#7CC5E0",
          longterm: "#54E0A8",
          traders: "#5BB6F0",
          nft: "#B488F0",
          bots: "#F0A24A",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ring: "0 0 0 1px rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
