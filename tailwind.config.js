/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          50:  '#E4FAF5',
          100: '#BDF3E6',
          200: '#8AE9D3',
          300: '#4EDFC0',
          400: '#20D4B8',
          500: '#10B89C',
          600: '#0A9A82',
          700: '#097868',
          800: '#0A5A4F',
          900: '#083F37',
        },
        ink: {
          900: '#0D1B1A',
          800: '#14302C',
          700: '#264944',
          600: '#4A6862',
          500: '#6E8984',
          400: '#97ADA9',
        },
        amber: '#FFB648',
        coral: '#FF7A59',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '28px',
      },
      boxShadow: {
        teal: '0 12px 28px rgba(32,212,184,0.32)',
      },
    },
  },
  plugins: [],
}
