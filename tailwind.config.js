/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palettes resolve to CSS variables defined in src/index.css.
        // The .dark class flips the variables, so existing class names
        // (bg-surface-100, text-surface-900, ...) adapt automatically.
        // rgb-triplet vars keep opacity modifiers (/40, /95) working.
        primary: {
          50: 'rgb(var(--mm-primary-50) / <alpha-value>)',
          100: 'rgb(var(--mm-primary-100) / <alpha-value>)',
          200: 'rgb(var(--mm-primary-200) / <alpha-value>)',
          300: 'rgb(var(--mm-primary-300) / <alpha-value>)',
          400: 'rgb(var(--mm-primary-400) / <alpha-value>)',
          500: 'rgb(var(--mm-primary-500) / <alpha-value>)',
          600: 'rgb(var(--mm-primary-600) / <alpha-value>)',
          700: 'rgb(var(--mm-primary-700) / <alpha-value>)',
          800: 'rgb(var(--mm-primary-800) / <alpha-value>)',
          900: 'rgb(var(--mm-primary-900) / <alpha-value>)',
          950: 'rgb(var(--mm-primary-950) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--mm-accent-50) / <alpha-value>)',
          100: 'rgb(var(--mm-accent-100) / <alpha-value>)',
          300: 'rgb(var(--mm-accent-300) / <alpha-value>)',
          500: 'rgb(var(--mm-accent-500) / <alpha-value>)',
          600: 'rgb(var(--mm-accent-600) / <alpha-value>)',
          700: 'rgb(var(--mm-accent-700) / <alpha-value>)',
        },
        surface: {
          50: 'rgb(var(--mm-surface-50) / <alpha-value>)',
          100: 'rgb(var(--mm-surface-100) / <alpha-value>)',
          200: 'rgb(var(--mm-surface-200) / <alpha-value>)',
          300: 'rgb(var(--mm-surface-300) / <alpha-value>)',
          400: 'rgb(var(--mm-surface-400) / <alpha-value>)',
          500: 'rgb(var(--mm-surface-500) / <alpha-value>)',
          600: 'rgb(var(--mm-surface-600) / <alpha-value>)',
          700: 'rgb(var(--mm-surface-700) / <alpha-value>)',
          800: 'rgb(var(--mm-surface-800) / <alpha-value>)',
          900: 'rgb(var(--mm-surface-900) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        pop: '0 4px 12px -2px rgb(15 23 42 / 0.12)',
      },
      borderRadius: { xl: '0.875rem' },
    },
  },
  plugins: [],
}
