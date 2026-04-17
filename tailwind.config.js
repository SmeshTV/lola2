/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          DEFAULT: '#5865F2',
          dark: '#4752C4',
        },
        mushroom: {
          neon: '#00FF87',
          glow: '#00cc6a',
          purple: '#6366f1',
          pink: '#db2777',
          dark: '#0a0a0f',
        }
      },
      backgroundImage: {
        'mushroom-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #0f0f1a 50%, #12121f 100%)',
        'neon-gradient': 'linear-gradient(135deg, #00ff87 0%, #6366f1 50%, #db2777 100%)',
      }
    },
  },
  plugins: [],
}
