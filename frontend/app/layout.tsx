import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { NativeShell } from '@/components/platform/native-shell';
import { isNativeBuild } from '@/lib/platform/native';

const nativeBuild = isNativeBuild();

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Kitcha',
  description: 'Plan meals, track groceries, and manage your budget with ease',
  keywords: ['meal planning', 'grocery', 'budget tracking', 'pantry management'],
  ...(nativeBuild
    ? {}
    : { appleWebApp: { capable: true, title: 'Kitcha', statusBarStyle: 'default' as const } }),
  icons: {
    icon: [
      { url: '/kitcha-logo.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  // Pinch-zoom is locked only in the native build; web keeps it.
  ...(nativeBuild ? { maximumScale: 1, userScalable: false } : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={nativeBuild ? 'light native' : 'light'}>
      <body className={`${inter.variable} bg-white font-sans text-gray-900 antialiased`}>
        <Providers>{children}</Providers>
        <NativeShell />
      </body>
    </html>
  );
}
