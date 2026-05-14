/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB', // A strong, trusting Royal Blue
          50: '#F0F7FF',      // Very faint blue for backgrounds
          100: '#E0EAFF',
          500: '#3B82F6',
          600: '#2563EB',     // Main Brand Color
          700: '#1D4ED8',     // Hover states
          800: '#1E40AF',     // Deep accent
          900: '#1E3A8A',     // Darkest blue
        },
        navy: {
          DEFAULT: '#0F172A', // Slate 900 - softer than pure black
          light: '#334155',   // Slate 700 - for secondary text
        },
        surface: '#F8FAFC',   // A very clean, medical off-white
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', 'sans-serif'], // Suggestion: Add these fonts in index.css
      },
      boxShadow: {
        'glow': '0 0 20px rgba(37, 99, 235, 0.15)', // Soft blue glow for cards
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)', // Ultra subtle
      }
    },
  },
  plugins: [],
}