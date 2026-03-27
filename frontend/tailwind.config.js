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
      keyframes: {
        'cta-gradient': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'cta-gradient': 'cta-gradient 16s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
