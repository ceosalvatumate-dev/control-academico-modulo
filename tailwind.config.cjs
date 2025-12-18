/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 35px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
