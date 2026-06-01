/** User-facing hint when Google rejects the Maps JavaScript API key. */
export const GOOGLE_MAPS_USER_ERROR =
  'Google Maps could not load. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env, enable Maps JavaScript API + billing in Google Cloud, and allow this origin in key restrictions (e.g. http://localhost:3001/*, https://votabase.iswot.in/*). Maps Embed API is not required.';

/** Env-only — never commit API keys to the repository. */
export function getGoogleMapsApiKeys() {
  const keys = [process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY]
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

export function getGoogleMapsApiKey() {
  return getGoogleMapsApiKeys()[0] || '';
}

let scriptPromise = null;
let loadedKey = '';

export function resetGoogleMapsLoader() {
  scriptPromise = null;
  loadedKey = '';
  removeGoogleMapsScripts();
}

function removeGoogleMapsScripts() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('script[data-google-maps="true"]').forEach((el) => el.remove());
  const g = window.google;
  if (g) {
    try {
      delete window.google;
    } catch {
      window.google = undefined;
    }
  }
  delete window.gm_authFailure;
  delete window.__googleMapsBoot;
}

function loadScriptWithKey(key) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      delete window.__googleMapsBoot;
      reject(err);
    };
    const ok = () => {
      if (settled) return;
      if (!window.google?.maps?.Map) {
        fail(new Error(GOOGLE_MAPS_USER_ERROR));
        return;
      }
      settled = true;
      loadedKey = key;
      resolve(window.google);
    };

    window.gm_authFailure = () => fail(new Error(GOOGLE_MAPS_USER_ERROR));
    window.__googleMapsBoot = ok;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=__googleMapsBoot`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onerror = () => fail(new Error('Failed to download Google Maps script.'));
    document.body.appendChild(script);
  });
}

/** Load Maps JavaScript API once per page. */
export function loadGoogleMapsScript() {
  const keys = getGoogleMapsApiKeys();
  if (!keys.length) {
    return Promise.reject(
      new Error('No Google Maps API key. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.development.local and restart the dev server.')
    );
  }
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Maps are not available during server render.'));
  }
  if (window.google?.maps?.Map && loadedKey && keys.includes(loadedKey)) {
    return Promise.resolve(window.google);
  }

  if (!scriptPromise) {
    scriptPromise = (async () => {
      let lastError = new Error(GOOGLE_MAPS_USER_ERROR);
      for (const key of keys) {
        removeGoogleMapsScripts();
        try {
          return await loadScriptWithKey(key);
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(GOOGLE_MAPS_USER_ERROR);
        }
      }
      scriptPromise = null;
      loadedKey = '';
      throw lastError;
    })();
  }

  return scriptPromise;
}
