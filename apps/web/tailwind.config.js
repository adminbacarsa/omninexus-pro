/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        module: {
          inversores: { bg: '#ecfdf5', border: '#a7f3d0', accent: '#059669' },
          plazo: { bg: '#fffbeb', border: '#fde68a', accent: '#d97706' },
          caja: { bg: '#fdf2f8', border: '#fbcfe8', accent: '#db2777' },
          flujo: { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
