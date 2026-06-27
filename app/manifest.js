export default function manifest() {
  return {
    name: 'Votabase',
    short_name: 'Votabase',
    description: 'Premium admin dashboard for Votabase — voter search, family tracking, and field operations.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: '#0c7bb3',
    background_color: '#eef4ff',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
