/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'text-primary': 'var(--text-primary, #1C1C1E)',
        'text-secondary': 'var(--text-secondary, #8E8E93)',
      },
    },
  },
  plugins: [],
};
