import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'InstaReport', template: '%s · InstaReport' },
  description: 'Instagram content audits for the team.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0b1326',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas font-sans text-body-md text-ink antialiased">{children}</body>
    </html>
  );
}
