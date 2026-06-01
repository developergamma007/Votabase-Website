'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'votabase:subtab:';

export function subtabStorageKey(pageId, scope = '') {
  const scopePart = scope ? `:${String(scope).trim()}` : '';
  return `${STORAGE_PREFIX}${pageId}${scopePart}`;
}

function pickAllowedTab(value, fallback, allowedIds) {
  if (!Array.isArray(allowedIds) || allowedIds.length === 0) {
    return value || fallback;
  }
  if (value && allowedIds.includes(value)) return value;
  if (fallback && allowedIds.includes(fallback)) return fallback;
  return allowedIds[0];
}

export function readPersistedSubtab(storageKey, fallback, allowedIds) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return pickAllowedTab(null, fallback, allowedIds);
    return pickAllowedTab(raw, fallback, allowedIds);
  } catch {
    return pickAllowedTab(null, fallback, allowedIds);
  }
}

export function writePersistedSubtab(storageKey, value) {
  if (typeof window === 'undefined' || value == null) return;
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Persist the selected sub-tab in localStorage so refresh keeps the same tab.
 */
export function usePersistedSubtab(storageKey, defaultTab, allowedTabIds) {
  const fallback = defaultTab ?? '';
  const allowedKey = Array.isArray(allowedTabIds) ? allowedTabIds.join('\0') : '';

  const [activeTab, setActiveTabState] = useState(() =>
    readPersistedSubtab(storageKey, fallback, allowedTabIds),
  );

  useEffect(() => {
    if (!Array.isArray(allowedTabIds) || allowedTabIds.length === 0) return;
    setActiveTabState((current) => pickAllowedTab(current, fallback, allowedTabIds));
  }, [storageKey, fallback, allowedKey]);

  const setActiveTab = useCallback((next) => {
    setActiveTabState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      writePersistedSubtab(storageKey, value);
      return value;
    });
  }, [storageKey]);

  return [activeTab, setActiveTab];
}
