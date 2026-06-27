'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'votabase-pwa-install-dismissed';

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(max-width: 768px)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

function isStandaloneApp() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isStandaloneApp()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    if (isIosDevice()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
      localStorage.setItem(DISMISS_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
    setInstallPrompt(null);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        localStorage.setItem(DISMISS_KEY, '1');
        setVisible(false);
      }
      setInstallPrompt(null);
    } catch {
      // Ignore prompt errors (e.g. user dismissed native dialog).
    } finally {
      setInstalling(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="login-pwa" role="region" aria-label="Install Votabase app">
      <div className="login-pwa__icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="login-pwa__body">
        <p className="login-pwa__title">Install Votabase on your phone</p>
        <p className="login-pwa__text">
          {iosHint
            ? 'Tap Share, then choose Add to Home Screen for quick access and offline support.'
            : 'Add Votabase to your home screen for faster sign-in and offline access to visited pages.'}
        </p>
        <div className="login-pwa__actions">
          {!iosHint ? (
            <button
              type="button"
              className="login-pwa__install"
              onClick={handleInstall}
              disabled={installing || !installPrompt}
            >
              {installing ? 'Opening install...' : 'Install app'}
            </button>
          ) : null}
          <button type="button" className="login-pwa__dismiss" onClick={handleDismiss}>
            {iosHint ? 'Got it' : 'Not now'}
          </button>
        </div>
      </div>
    </div>
  );
}
