/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0C0C0C',
        surface: '#161616',
        surface2: '#1E1E1E',
        border: '#2A2A2A',
        'border-light': '#383838',
        text: '#FFFFFF',
        'text-secondary': '#888888',
        'text-muted': '#555555',
        accent: '#FF4500',
        'accent-dim': '#FF450020',
        gold: '#FFB800',
        'gold-dim': '#FFB80020',
        success: '#22C55E',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
