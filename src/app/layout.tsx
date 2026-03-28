import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Safety & Environment Dashboard',
  description: 'HQ Dashboard — Safety & Environment Action Plan Tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" defer />
      </head>
      <body className="antialiased mesh-gradient min-h-screen">
        {children}
      </body>
    </html>
  );
}
