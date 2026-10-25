import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        skyline: {
          blue: "#2563EB",
          ink: "#111827",
          surface: "#F8FAFC",
        },
      },
    },
  },
  plugins: [],
};

export default config;

