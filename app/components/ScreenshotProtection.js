'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const BODY_CLASS = 'votabase-no-capture';
/** Blur/shield content shortly after the user stops interacting (catches many mobile/desktop captures). */
const IDLE_SHIELD_MS = 900;
/** Keep content hidden briefly when a screenshot shortcut is detected. */
const SHORTCUT_SHIELD_MS = 800;

function readWatermarkLabel() {
  if (typeof window === 'undefined') return 'Votabase';
  try {
    const name =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('user');
    const phone = localStorage.getItem('phone');
    if (name && phone) return `${name} · ${phone}`;
    if (name) return String(name);
  } catch {
    /* ignore */
  }
  return 'Votabase · confidential';
}

function isScreenshotShortcut(event) {
  const key = String(event.key || '').toLowerCase();
  const code = String(event.code || '');

  if (key === 'printscreen' || code === 'PrintScreen') return true;
  // macOS: Cmd+Shift+3/4/5
  if (event.metaKey && event.shiftKey && ['3', '4', '5', 's'].includes(key)) return true;
  // Windows: Win+Shift+S (Snipping Tool), Win+PrtScn
  if (event.shiftKey && key === 's' && (event.metaKey || event.getModifierState?.('OS'))) return true;
  if (code === 'PrintScreen' && (event.metaKey || event.ctrlKey)) return true;

  return false;
}

function shouldForceShield() {
  return document.visibilityState === 'hidden' || !document.hasFocus();
}

function setShieldDataset(on) {
  if (on) {
    document.body.dataset.votabaseShielded = '1';
  } else {
    delete document.body.dataset.votabaseShielded;
    delete document.body.dataset.votabaseIdleShield;
  }
}

export default function ScreenshotProtection() {
  const [mounted, setMounted] = useState(false);
  const [shieldVisible, setShieldVisible] = useState(false);
  const [watermark, setWatermark] = useState('Votabase');

  const applyShield = useCallback((reason = 'manual') => {
    setShieldVisible(true);
    setShieldDataset(true);
    if (reason === 'idle') {
      document.body.dataset.votabaseIdleShield = '1';
    }
  }, []);

  const clearShieldIfAllowed = useCallback(() => {
    if (shouldForceShield()) {
      applyShield('focus');
      return;
    }
    setShieldVisible(false);
    setShieldDataset(false);
  }, [applyShield]);

  useEffect(() => {
    setMounted(true);
    setWatermark(readWatermarkLabel());

    const refreshWatermark = () => setWatermark(readWatermarkLabel());
    window.addEventListener('storage', refreshWatermark);
    window.addEventListener('votabase-auth-updated', refreshWatermark);

    return () => {
      window.removeEventListener('storage', refreshWatermark);
      window.removeEventListener('votabase-auth-updated', refreshWatermark);
    };
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return undefined;

    document.body.classList.add(BODY_CLASS);

    let idleTimer = null;
    let shortcutTimer = null;

    const clearIdleTimer = () => {
      if (idleTimer != null) {
        window.clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const scheduleIdleShield = () => {
      clearIdleTimer();
      if (shouldForceShield()) {
        applyShield('focus');
        return;
      }
      delete document.body.dataset.votabaseIdleShield;
      setShieldVisible(false);
      setShieldDataset(false);

      idleTimer = window.setTimeout(() => {
        if (!shouldForceShield()) {
          applyShield('idle');
        }
      }, IDLE_SHIELD_MS);
    };

    const onActivity = () => {
      if (shortcutTimer != null) return;
      clearShieldIfAllowed();
      scheduleIdleShield();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearIdleTimer();
        applyShield('hidden');
      } else {
        scheduleIdleShield();
      }
    };

    const onWindowBlur = () => {
      clearIdleTimer();
      applyShield('blur');
    };

    const onWindowFocus = () => {
      if (shortcutTimer != null) return;
      scheduleIdleShield();
    };

    const onPageHide = () => {
      clearIdleTimer();
      applyShield('pagehide');
    };

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    const onKeyDown = (event) => {
      if (!isScreenshotShortcut(event)) {
        onActivity();
        return;
      }
      event.preventDefault();
      clearIdleTimer();
      applyShield('shortcut');
      if (shortcutTimer != null) window.clearTimeout(shortcutTimer);
      shortcutTimer = window.setTimeout(() => {
        shortcutTimer = null;
        clearShieldIfAllowed();
        scheduleIdleShield();
      }, SHORTCUT_SHIELD_MS);
      navigator.clipboard?.writeText?.('').catch(() => {});
    };

    const onKeyUp = (event) => {
      if (event.key === 'PrintScreen') {
        event.preventDefault();
        onKeyDown(event);
      }
    };

    const onDragStart = (event) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };

    const onBeforePrint = () => {
      document.body.dataset.votabasePrintBlocked = '1';
      applyShield('print');
    };

    const onAfterPrint = () => {
      delete document.body.dataset.votabasePrintBlocked;
      clearShieldIfAllowed();
      scheduleIdleShield();
    };

    const onCopy = (event) => {
      const target = event.target;
      const tag = target?.tagName?.toLowerCase?.() || '';
      if (tag !== 'input' && tag !== 'textarea' && !target?.isContentEditable) {
        event.preventDefault();
      }
    };

    const events = ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'keydown', 'scroll', 'wheel'];
    events.forEach((name) => document.addEventListener(name, onActivity, { passive: true }));

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('copy', onCopy);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    scheduleIdleShield();

    return () => {
      clearIdleTimer();
      if (shortcutTimer != null) window.clearTimeout(shortcutTimer);
      document.body.classList.remove(BODY_CLASS);
      setShieldDataset(false);
      delete document.body.dataset.votabasePrintBlocked;
      events.forEach((name) => document.removeEventListener(name, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('copy', onCopy);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [mounted, applyShield, clearShieldIfAllowed]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="votabase-capture-watermark" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span key={index}>{watermark}</span>
        ))}
      </div>
      {shieldVisible ? (
        <div className="votabase-capture-shield" role="presentation">
          <p>Protected content</p>
          <span>Screenshots are disabled for this session</span>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
