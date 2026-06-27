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

function ShareIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0l-4 4m4-4l4 4M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IosInstallGuide({ onClose }) {
  return (
    <div className="login-pwa-guide" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title">
      <button type="button" className="login-pwa-guide__backdrop" aria-label="Close guide" onClick={onClose} />
      <div className="login-pwa-guide__sheet">
        <div className="login-pwa-guide__handle" aria-hidden="true" />
        <h3 id="pwa-guide-title" className="login-pwa-guide__title">
          Add Votabase to Home Screen
        </h3>
        <p className="login-pwa-guide__intro">
          iPhone requires two quick taps in Safari. Follow these steps:
        </p>

        <ol className="login-pwa-guide__steps">
          <li>
            <span className="login-pwa-guide__step-icon">
              <ShareIcon />
            </span>
            <div>
              <strong>Tap Share</strong>
              <p>Use the Share button at the bottom of Safari (square with arrow up).</p>
            </div>
          </li>
          <li>
            <span className="login-pwa-guide__step-icon">
              <PlusSquareIcon />
            </span>
            <div>
              <strong>Tap Add to Home Screen</strong>
              <p>Scroll the menu if needed, then choose Add to Home Screen.</p>
            </div>
          </li>
          <li>
            <span className="login-pwa-guide__step-icon login-pwa-guide__step-icon--text">Add</span>
            <div>
              <strong>Confirm</strong>
              <p>Tap Add in the top-right corner. Votabase will appear on your home screen.</p>
            </div>
          </li>
        </ol>

        <button type="button" className="login-pwa__install login-pwa-guide__done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

export default function PwaInstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const mobile = isMobileDevice();
    const ios = isIosDevice();
    const installed = isStandaloneApp();

    setMounted(true);
    setIosDevice(ios);
    setStandalone(installed);

    if (!mobile || installed) return;

    if (ios) {
      setVisible(true);
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
      setStandalone(true);
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
        setStandalone(true);
      }
      setInstallPrompt(null);
    } catch {
      // User dismissed the native install dialog.
    } finally {
      setInstalling(false);
    }
  };

  const handleIosAddClick = () => {
    setShowGuide(true);
  };

  if (!mounted || standalone || !visible) return null;

  return (
    <>
      <div className="login-pwa" role="region" aria-label="Install Votabase app">
        <div className="login-pwa__icon" aria-hidden="true">
          <PlusSquareIcon />
        </div>
        <div className="login-pwa__body">
          <p className="login-pwa__title">
            {iosDevice ? 'Add Votabase to Home Screen' : 'Install Votabase on your phone'}
          </p>
          <p className="login-pwa__text">
            {iosDevice
              ? 'Open the Safari steps to pin Votabase on your home screen for quick access and offline pages.'
              : 'Add Votabase to your home screen for faster sign-in and offline access to visited pages.'}
          </p>
          <div className="login-pwa__actions">
            {iosDevice ? (
              <button type="button" className="login-pwa__install" onClick={handleIosAddClick}>
                Add to Home Screen
              </button>
            ) : (
              <button
                type="button"
                className="login-pwa__install"
                onClick={handleInstall}
                disabled={installing || !installPrompt}
              >
                {installing ? 'Opening install...' : 'Install app'}
              </button>
            )}
            {!iosDevice ? (
              <button type="button" className="login-pwa__dismiss" onClick={handleDismiss}>
                Not now
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {showGuide ? <IosInstallGuide onClose={() => setShowGuide(false)} /> : null}
    </>
  );
}
