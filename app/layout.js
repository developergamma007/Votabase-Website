import './globals.css';
import Providers from './providers';

const APP_NAME = 'Votabase';
const APP_DEFAULT_TITLE = 'Votabase';
const APP_TITLE_TEMPLATE = '%s | Votabase';
const APP_DESCRIPTION =
  'Premium admin dashboard for Votabase — voter search, family tracking, and field operations.';

export const metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport = {
  themeColor: '#0c7bb3',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="app-font">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
