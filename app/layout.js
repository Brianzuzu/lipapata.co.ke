import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Lipapata | Helping creators get paid by their clients',
  description: 'The premium platform for creators to securely share assets, manage payments, and ensure instant delivery once paid.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
          <meta property="og:title" content="Lipapata | Helping creators get paid by their clients" />
          <meta property="og:description" content="Premium platform for creators to securely share assets, manage payments, and ensure instant delivery." />
          <meta property="og:image" content="https://lipapata.co.ke/og-image.png" />
          <meta property="og:url" content="https://lipapata.co.ke/" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Lipapata | Helping creators get paid by their clients" />
          <meta name="twitter:description" content="Premium platform for creators to securely share assets, manage payments, and ensure instant delivery." />
          <meta name="twitter:image" content="https://lipapata.co.ke/og-image.png" />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"LocalBusiness","name":"Lipapata","url":"https://lipapata.co.ke","logo":"https://lipapata.co.ke/logo-v2.png","description":"Premium platform for creators to securely share assets, manage payments, and ensure instant delivery.","address":{"@type":"PostalAddress","addressLocality":"Nairobi","addressCountry":"KE"},"telephone":"+254-XXX-XXXX","openingHours":"Mo-Fr 09:00-18:00"}) }} />
        </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
