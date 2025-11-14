import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Kitcha',
  description: 'Plan meals, track groceries, and manage your budget with ease',
  keywords: ['meal planning', 'grocery', 'budget tracking', 'pantry management'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="light">
      <head>
        <link rel="icon" href="/kitcha-logo.svg" />
      </head>
      <body className={`${inter.variable} bg-white font-sans text-gray-900 antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
