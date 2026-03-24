import type { Metadata, Viewport } from 'next';
import { ConditionalShell } from '@/components/ConditionalShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalesFlow',
  description: 'Walk in. Pitch. Sell.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SalesFlow',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ConditionalShell>{children}</ConditionalShell>
      </body>
    </html>
  );
}
