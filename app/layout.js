import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'Votabase',
  description: 'Premium admin dashboard for Votabase',
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
