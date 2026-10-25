/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d0c0a",
        // Warm graphite ("wax") scale. Kept under the `zinc` name so every
        // existing utility picks up the palette without page rewrites.
        zinc: {
          950: "#0d0c0a",
          900: "#16140f",
          800: "#25221b",
          700: "#38342a",
          600: "#5c5648",
          500: "#857e6d",
          400: "#aaa393",
          300: "#cfc9bb",
          200: "#e3ded2",
          100: "#f1ede4",
          50: "#f8f6f0",
        },
        // Honey: the UI accent. Primary actions, focus, best pick, leader.
        honey: {
          200: "#ffe6a8",
          300: "#ffd77a",
          400: "#f7bf3c",
          500: "#e9a514",
          600: "#b97f08",
          900: "#3a2a06",
        },
        // Robot profile colors, used only to encode the four scoring profiles.
        role: {
          auto: "#6cb6ff",
          hive: "#f7bf3c",
          flower: "#ec8fbd",
          reliability: "#7ccf95",
        },
        // Risk only: collisions, DNF, destructive actions.
        sting: "#ff7a59",
      },
      fontFamily: {
        display: ["Unbounded", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Onest", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        focus: "0 0 0 3px #0d0c0a, 0 0 0 6px #f7bf3c",
      },
      outlineStyle: {
        "focus-visible": "solid",
      },
    },
  },
  plugins: [],
};
