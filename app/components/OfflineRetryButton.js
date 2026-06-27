'use client';

export default function OfflineRetryButton() {
  return (
    <button type="button" className="offline-page__retry" onClick={() => window.location.reload()}>
      Try again
    </button>
  );
}
