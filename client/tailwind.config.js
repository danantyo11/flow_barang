/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fbf8ea',
          100: '#f5edc9',
          200: '#edd893',
          300: '#e3be57',
          400: '#d9a629',
          500: '#b8861b', // Golden primary
          600: '#946614',
          700: '#754b13',
          800: '#633d16',
          900: '#553417',
        },
      },
    },
  },
  plugins: [],
}
