import OfflineRetryButton from '../components/OfflineRetryButton';

export const metadata = {
  title: 'Offline - Votabase',
  description: 'You are currently offline. Reconnect to continue using Votabase.',
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-page__card">
        <div className="offline-page__icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M2 2l20 20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1>You&apos;re offline</h1>
        <p>
          Votabase can show pages you&apos;ve already opened. For live voter data and updates,
          reconnect to the internet and try again.
        </p>
        <OfflineRetryButton />
      </div>
    </main>
  );
}
