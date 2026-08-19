/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/web/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif'],
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        shelf: {
          50: '#faf9f7',
          100: '#f3f1ec',
          200: '#e7e3da',
          300: '#d6cfc0',
          400: '#bcb29c',
          500: '#a89c80',
          600: '#8a8274',
          700: '#6c655a',
          800: '#4a453d',
          900: '#1a1816',
        },
      },
    },
  },
  plugins: [],
};