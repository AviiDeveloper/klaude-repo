import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalesFlow',
  description: 'Lead management for field sales teams.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SalesFlow',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
