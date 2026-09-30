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
  themeColor: '#f6f5fb',
  colorScheme: 'light dark',
};

// Runs before first paint so the saved theme never flashes. Light is the default.
const THEME_INIT = "try{if(localStorage.getItem('theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-body-md text-ink antialiased">{children}</body>
    </html>
  );
}
