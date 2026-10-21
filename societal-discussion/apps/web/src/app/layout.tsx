import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Vaalikeskustelu admin',
  description: 'Research administration for the Vaalikeskustelu study',
  other: {
    google: 'notranslate',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fi" translate="no" suppressHydrationWarning>
      <body className={`${inter.className} notranslate`} translate="no" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
