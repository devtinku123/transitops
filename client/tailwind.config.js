/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14171F',
        slate: {
          850: '#1b2028'
        },
        accent: '#3E7BFA',
        warn: '#F59E0B',
        danger: '#EF4444',
        ok: '#22C55E'
      }
    }
  },
  plugins: []
};
