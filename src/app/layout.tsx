import type { Metadata } from 'next';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Safety & Environment Dashboard',
  description: 'HQ Dashboard — Safety & Environment Action Plan Tracking',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" defer />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme') || 'light';
                const resolved = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
                document.documentElement.setAttribute('data-theme', resolved);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen transition-theme">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
