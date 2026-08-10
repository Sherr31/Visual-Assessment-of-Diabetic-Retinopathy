/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#0F4C81", light: "#1a6bbd", dark: "#0a3560" },
        secondary: "#3A86FF",
        "light-blue": "#EAF4FF",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        purple: "#7C3AED",
      },
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        display: ["'Sora'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        card: "0 4px 24px rgba(15,76,129,0.08)",
        "card-hover": "0 8px 40px rgba(15,76,129,0.16)",
        glow: "0 0 24px rgba(58,134,255,0.25)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
        float: "float 6s ease-in-out infinite",
        "count-up": "countUp 1s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
