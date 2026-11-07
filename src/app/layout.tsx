import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Darker_Grotesque, DM_Sans } from 'next/font/google';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import AppShell from '@/components/layout/AppShell';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
});
const darker = Darker_Grotesque({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-darker-grotesque',
  display: 'swap',
});

const DESCRIPTION = 'An interactive point-cloud tribute to a fictional footballer. Placeholder content for a design build.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'The Last Tempo / Placeholder tribute',
  description: DESCRIPTION,
  openGraph: { title: 'The Last Tempo', description: DESCRIPTION, type: 'website', siteName: 'The Last Tempo', images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: 'The Last Tempo', description: DESCRIPTION, images: ['/og.png'] },
  icons: { icon: '/svg/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#030c1c',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={clsx(dmSans.variable, cormorant.variable, darker.variable, 'ui-enter')}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
