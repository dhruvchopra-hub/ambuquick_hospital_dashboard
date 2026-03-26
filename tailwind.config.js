/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ambu: {
          red: '#D91A2A',
          'red-dark': '#B51522',
          'red-light': '#FEE2E2',
          'red-muted': '#F87171',
          bg: '#F8F7F4',
          surface: '#FFFFFF',
          dark: '#0F0F0F',
          muted: '#6B6560',
          border: '#E5E2DC',
          success: '#2D6A2D',
          'success-bg': '#DCFCE7',
          warning: '#92500A',
          'warning-bg': '#FEF9C3',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
