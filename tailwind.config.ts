import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
        serif: ['Fraunces', 'serif'],
      },
      colors: {
        // Dark theme base
        dark: {
          bg:   '#0f0f11',
          bg2:  '#161618',
          bg3:  '#1e1e22',
          bg4:  '#26262c',
        },
        // Light/cream theme base
        cream: {
          bg:   '#f4efe6',
          bg2:  '#ece6db',
          bg3:  '#e3dcd1',
          bg4:  '#d5cdc0',
        },
        accent: {
          DEFAULT: '#7c5cfc',
          dim:    'rgba(124,92,252,0.15)',
          dark:   '#5e3fde',
        },
        risk: {
          low:      '#4ade80',
          medium:   '#f5a623',
          high:     '#f05252',
          critical: '#ff4444',
        },
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
} satisfies Config
