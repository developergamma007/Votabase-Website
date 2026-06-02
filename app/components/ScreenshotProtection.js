'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const BODY_CLASS = 'votabase-no-capture';
/** How long the “Protected content” screen stays up after a detected attempt. */
const SHIELD_MS = 1800;
/** Quick hide/show often means the OS screenshot UI opened (Android / some WebViews). */
const MOBILE_QUICK_HIDE_MS = 700;
/** Sustained hide with page still backgrounded — screenshot editor or capture chrome. */
const MOBILE_SUSTAINED_HIDE_MS = 280;

function isScreenshotShortcut(event) {
  const key = String(event.key || '').toLowerCase();
  const code = String(event.code || '');

  if (key === 'printscreen' || code === 'PrintScreen') return true;
  if (event.metaKey && event.shiftKey && ['3', '4', '5', 's'].includes(key)) return true;
  if (event.shiftKey && key === 's' && (event.metaKey || event.getModifierState?.('OS'))) return true;
  if (code === 'PrintScreen' && (event.metaKey || event.ctrlKey)) return true;

  return false;
}

function isMobileWebClient() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const narrow = window.matchMedia?.('(max-width: 900px)')?.matches;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return ua || (coarse && narrow);
}

export default function ScreenshotProtection() {
  const [mounted, setMounted] = useState(false);
  const [shieldVisible, setShieldVisible] = useState(false);
  const shieldTimerRef = useRef(null);
  const hiddenAtRef = useRef(0);
  const sustainedHideTimerRef = useRef(null);

  const flashShield = useCallback(() => {
    setShieldVisible(true);
    document.body.dataset.votabaseShielded = '1';

    if (shieldTimerRef.current != null) {
      window.clearTimeout(shieldTimerRef.current);
    }

    shieldTimerRef.current = window.setTimeout(() => {
      setShieldVisible(false);
      delete document.body.dataset.votabaseShielded;
      shieldTimerRef.current = null;
    }, SHIELD_MS);

    navigator.clipboard?.writeText?.('').catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return undefined;

    const mobileWeb = isMobileWebClient();
    document.body.classList.add(BODY_CLASS);

    const clearSustainedHideTimer = () => {
      if (sustainedHideTimerRef.current != null) {
        window.clearTimeout(sustainedHideTimerRef.current);
        sustainedHideTimerRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (!mobileWeb) return;

      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        clearSustainedHideTimer();
        sustainedHideTimerRef.current = window.setTimeout(() => {
          if (!document.hidden) return;
          const hiddenFor = Date.now() - hiddenAtRef.current;
          if (hiddenFor >= MOBILE_SUSTAINED_HIDE_MS) {
            flashShield();
          }
        }, MOBILE_SUSTAINED_HIDE_MS);
        return;
      }

      clearSustainedHideTimer();
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = 0;
      if (!hiddenAt) return;

      const hiddenMs = Date.now() - hiddenAt;
      if (hiddenMs > 0 && hiddenMs <= MOBILE_QUICK_HIDE_MS) {
        flashShield();
      }
    };

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    const onKeyDown = (event) => {
      if (!isScreenshotShortcut(event)) return;
      event.preventDefault();
      flashShield();
    };

    const onKeyUp = (event) => {
      if (event.key === 'PrintScreen') {
        event.preventDefault();
        flashShield();
      }
    };

    const onDragStart = (event) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };

    const onBeforePrint = () => {
      document.body.dataset.votabasePrintBlocked = '1';
      flashShield();
    };

    const onAfterPrint = () => {
      delete document.body.dataset.votabasePrintBlocked;
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    return () => {
      clearSustainedHideTimer();
      if (shieldTimerRef.current != null) {
        window.clearTimeout(shieldTimerRef.current);
      }
      document.body.classList.remove(BODY_CLASS);
      delete document.body.dataset.votabaseShielded;
      delete document.body.dataset.votabasePrintBlocked;
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [mounted, flashShield]);

  if (!mounted || !shieldVisible) return null;

  return createPortal(
    <div className="votabase-capture-shield" role="presentation" aria-live="assertive">
      <p>Protected content</p>
      <span>Screenshots are not allowed</span>
    </div>,
    document.body,
  );
}
