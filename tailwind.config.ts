import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#08111f",
        foreground: "#f8fafc",
        card: "#101a2e",
        primary: "#38bdf8",
        secondary: "#f59e0b",
        muted: "#94a3b8",
        danger: "#ef4444",
        success: "#22c55e"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(8, 17, 31, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
