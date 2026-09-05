/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#E65100",
        primaryDark: "#BF360C",
        primaryLight: "#FF9800",
        surface: "#FFF8F2",
        ink: "#1F2937",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(31, 41, 55, 0.08)",
      },
    },
  },
  plugins: [],
};
