import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { siteUrl } from '@/lib/site';
import './globals.css';

const fraunces = localFont({ src: '../fonts/fraunces.woff2', variable: '--font-fraunces', weight: '300 900', display: 'swap' });
const figtree = localFont({ src: '../fonts/figtree.woff2', variable: '--font-figtree', weight: '300 900', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'RateMe.ie — Ratings of Irish businesses from real customers', template: '%s · RateMe.ie' },
  description: 'Discover Irish businesses. Share your experience. Help people choose with confidence. Free for customers, with a fair, transparent review policy.',
  applicationName: 'RateMe.ie',
  openGraph: { type: 'website', locale: 'en_IE', siteName: 'RateMe.ie' },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#0d5c61', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IE" className={`${fraunces.variable} ${figtree.variable}`}>
      <body className="min-h-screen antialiased">
        <a href="#main" className="skip-link">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
