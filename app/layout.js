import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Lipapata | Helping creators get paid by their clients',
  description: 'The premium platform for creators to securely share assets, manage payments, and ensure instant delivery once paid.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo-v2.png" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
