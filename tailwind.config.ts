import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        card: '#1c1c1e',
        border: 'rgba(255, 255, 255, 0.08)',
        muted: 'rgba(255, 255, 255, 0.45)',
        accent: '#0a84ff',
        success: '#30d158',
        warning: '#ffd60a',
        danger: '#ff453a',
        info: '#5ac8fa',
      },
      borderRadius: {
        'apple': '16px',
        'apple-lg': '20px',
        'apple-xl': '24px',
      },
      boxShadow: {
        'apple': '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.05)',
        'apple-lg': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.05)',
        'apple-glow': '0 0 20px rgba(10, 132, 255, 0.15)',
      },
    },
  },
  plugins: [],
}
export default config
