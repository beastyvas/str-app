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
        // Iron & Brass — keep in sync with src/constants/colors.ts
        bg: '#101012',
        surface: '#1A191C',
        surface2: '#232125',
        border: '#26242A',
        'border-light': '#37343C',
        text: '#F4F1EC',
        'text-secondary': '#A09B93',
        'text-muted': '#6D6862',
        accent: '#D9A441',
        'accent-dim': '#D9A44120',
        gold: '#E3B341',
        'gold-dim': '#E3B34120',
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
