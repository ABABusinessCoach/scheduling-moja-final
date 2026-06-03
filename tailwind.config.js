/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Quicksand', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Moja brand palette
        moja: {
          blue:   '#355574',
          orange: '#e66d38',
          aqua:   '#6dccc2',
          yellow: '#efd35c',
          pink:   '#df76b6',
        },
        // Semantic ramps used throughout the app
        brand: {
          50:  '#eef4f8',
          100: '#d6e4ed',
          200: '#aec8db',
          300: '#7ea9c6',
          400: '#5589ad',
          500: '#355574',
          600: '#2c4762',
          700: '#233a51',
          800: '#1a2c3f',
          900: '#111e2d',
        },
        accent: {
          50:  '#fdf2ec',
          100: '#fae0d0',
          200: '#f5bea1',
          300: '#ef9972',
          400: '#e87d52',
          500: '#e66d38',
          600: '#c95a28',
          700: '#a8481f',
          800: '#863717',
          900: '#64280f',
        },
        aqua: {
          50:  '#edfaf9',
          100: '#d4f3f1',
          200: '#a5e6e2',
          300: '#6dccc2',
          400: '#4db8ad',
          500: '#35a09a',
          600: '#278580',
          700: '#1d6965',
          800: '#134d4a',
          900: '#0a3230',
        },
      },
    },
  },
  plugins: [],
};
