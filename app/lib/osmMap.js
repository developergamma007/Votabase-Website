import {
  buildFamilyMapTooltipHtml,
  getFamilyAvailabilityMapColor,
} from './familyFormHelpers';

let leafletPromise = null;

const DEFAULT_CENTER = [12.9716, 77.5946];

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

export function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Map is not available during server render.'));
  }
  if (window.L?.map) {
    return Promise.resolve(window.L);
  }
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet-css="true"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leafletCss = 'true';
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-leaflet-js="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load map library.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.defer = true;
      script.dataset.leafletJs = 'true';
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error('Failed to load map library.'));
      };
      document.body.appendChild(script);
    });
  }
  return leafletPromise;
}

export function destroyOsmMap(map) {
  if (map?.remove) {
    try {
      map.remove();
    } catch {
      /* ignore */
    }
  }
}

export function getOsmEmbedUrl(lat, lng, zoom = 15) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
  const delta = 0.01;
  const bbox = `${lngNum - delta},${latNum - delta},${lngNum + delta},${latNum + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latNum}%2C${lngNum}`;
}

export function getOsmExternalUrl(lat, lng, zoom = 17) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
  return `https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lngNum}#map=${zoom}/${latNum}/${lngNum}`;
}

function addOsmTiles(map, L) {
  L.tileLayer(OSM_TILE.url, {
    attribution: OSM_TILE.attribution,
    maxZoom: OSM_TILE.maxZoom,
  }).addTo(map);
}

function invalidateSoon(map) {
  requestAnimationFrame(() => {
    map?.invalidateSize?.();
  });
}

/** Family map with availability-coloured markers. */
export async function buildFamilyOsmMap(container, points = [], options = {}) {
  const { fullDetails = false } = options;
  if (!container) return null;

  const L = await loadLeaflet();
  container.innerHTML = '';

  const validPoints = (points || []).filter(
    (p) =>
      Number.isFinite(p.latitude)
      && Number.isFinite(p.longitude)
      && !(p.latitude === 0 && p.longitude === 0),
  );

  const center = validPoints.length
    ? [validPoints[0].latitude, validPoints[0].longitude]
    : DEFAULT_CENTER;

  const map = L.map(container, { zoomControl: true }).setView(center, validPoints.length ? 14 : 11);
  addOsmTiles(map, L);

  const layerGroup = L.featureGroup();

  validPoints.forEach((point) => {
    const color = getFamilyAvailabilityMapColor(point.familyAvailability);
    const marker = L.circleMarker([point.latitude, point.longitude], {
      radius: 9,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.95,
    });
    marker.bindPopup(buildFamilyMapTooltipHtml(point, { full: fullDetails }), { maxWidth: 360 });
    layerGroup.addLayer(marker);
  });

  layerGroup.addTo(map);

  if (validPoints.length >= 2) {
    map.fitBounds(layerGroup.getBounds().pad(0.15));
  } else if (validPoints.length === 1) {
    map.setView(center, 16);
  }

  invalidateSoon(map);
  return map;
}

/** Multiple points with custom colour + popup. */
export async function buildPointsOsmMap(container, points = [], options = {}) {
  const {
    getColor = () => '#2563eb',
    getPopupHtml = () => '',
    defaultZoom = 13,
  } = options;

  if (!container) return null;
  const L = await loadLeaflet();
  container.innerHTML = '';

  const validPoints = (points || []).filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );

  const center = validPoints.length
    ? [validPoints[0].latitude, validPoints[0].longitude]
    : DEFAULT_CENTER;

  const map = L.map(container, { zoomControl: true }).setView(center, defaultZoom);
  addOsmTiles(map, L);

  const layerGroup = L.featureGroup();

  validPoints.forEach((point) => {
    const marker = L.circleMarker([point.latitude, point.longitude], {
      radius: 7,
      fillColor: getColor(point),
      color: '#ffffff',
      weight: 2,
      fillOpacity: 0.9,
    });
    const html = getPopupHtml(point);
    if (html) marker.bindPopup(html, { maxWidth: 360 });
    layerGroup.addLayer(marker);
  });

  layerGroup.addTo(map);

  if (validPoints.length >= 2) {
    map.fitBounds(layerGroup.getBounds().pad(0.12));
  } else if (validPoints.length === 1) {
    map.setView(center, 15);
  }

  invalidateSoon(map);
  return map;
}

/** Single draggable pin (booth / promotion location). */
export async function buildDraggableOsmMap(container, options = {}) {
  const {
    lat = DEFAULT_CENTER[0],
    lng = DEFAULT_CENTER[1],
    zoom = 15,
    onPositionChange,
  } = options;

  if (!container) return { map: null, marker: null };

  const L = await loadLeaflet();
  container.innerHTML = '';

  const map = L.map(container, { zoomControl: true }).setView([lat, lng], zoom);
  addOsmTiles(map, L);

  const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  const emit = () => {
    const pos = marker.getLatLng();
    onPositionChange?.(pos.lat, pos.lng);
  };

  marker.on('dragend', emit);

  invalidateSoon(map);
  return { map, marker };
}

/** Click to place pin; optional draggable pin. */
export async function buildClickableOsmMap(container, options = {}) {
  const {
    lat = DEFAULT_CENTER[0],
    lng = DEFAULT_CENTER[1],
    zoom = 14,
    draggable = false,
    onPositionChange,
  } = options;

  if (!container) return { map: null, marker: null };

  const L = await loadLeaflet();
  container.innerHTML = '';

  const map = L.map(container, { zoomControl: true }).setView([lat, lng], zoom);
  addOsmTiles(map, L);

  let marker = L.marker([lat, lng], { draggable }).addTo(map);

  const setPosition = (nextLat, nextLng) => {
    marker.setLatLng([nextLat, nextLng]);
    onPositionChange?.(nextLat, nextLng);
  };

  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    onPositionChange?.(pos.lat, pos.lng);
  });

  map.on('click', (event) => {
    const { lat: clickLat, lng: clickLng } = event.latlng;
    if (!marker) {
      marker = L.marker([clickLat, clickLng], { draggable }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onPositionChange?.(pos.lat, pos.lng);
      });
    } else {
      marker.setLatLng([clickLat, clickLng]);
    }
    onPositionChange?.(clickLat, clickLng);
  });

  invalidateSoon(map);
  return { map, marker, setPosition };
}

/** WebView HTML for React Native (Leaflet + OSM). */
export function buildOsmWebViewHtml(lat, lng, options = {}) {
  const latN = Number(lat) || DEFAULT_CENTER[0];
  const lngN = Number(lng) || DEFAULT_CENTER[1];
  const zoom = options.zoom ?? 15;
  const draggable = options.draggable ? 'true' : 'false';

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${latN}, ${lngN}], ${zoom});
    L.tileLayer('${OSM_TILE.url}', { attribution: '${OSM_TILE.attribution}', maxZoom: 19 }).addTo(map);
    var marker = L.marker([${latN}, ${lngN}], { draggable: ${draggable} }).addTo(map);
    if (${draggable}) {
      marker.on('dragend', function() {
        var p = marker.getLatLng();
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ lat: p.lat, lng: p.lng }));
      });
    }
    setTimeout(function(){ map.invalidateSize(); }, 200);
  </script>
</body>
</html>`;
}
