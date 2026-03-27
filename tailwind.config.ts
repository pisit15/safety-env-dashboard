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
        bg: '#09090b',
        card: '#18181b',
        border: '#27272a',
        muted: '#71717a',
        accent: '#3b82f6',
        success: '#4ade80',
        warning: '#fbbf24',
        danger: '#fb923c',
        info: '#00d4ff',
      },
    },
  },
  plugins: [],
}
export default config
