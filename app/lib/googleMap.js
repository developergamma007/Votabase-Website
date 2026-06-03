import {
  buildFamilyMapTooltipHtml,
  getFamilyAvailabilityMapColor,
} from './familyFormHelpers';
import { getGoogleMapsApiKey, loadGoogleMapsScript } from './googleMaps';

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

function toLatLng(lat, lng) {
  return { lat: Number(lat), lng: Number(lng) };
}

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function createMap(container, center, zoom) {
  return new window.google.maps.Map(container, {
    center: toLatLng(center.lat, center.lng),
    zoom,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });
}

function fitMapToMarkers(map, markers) {
  if (!markers.length) return;
  if (markers.length === 1) {
    map.setCenter(markers[0].getPosition());
    map.setZoom(16);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  markers.forEach((marker) => {
    const pos = marker.getPosition?.();
    if (pos) bounds.extend(pos);
  });
  map.fitBounds(bounds, 48);
}

function attachMapMeta(map, container, markers = [], infoWindows = []) {
  map.__container = container;
  map.__markers = markers;
  map.__infoWindows = infoWindows;
  map.invalidateSize = () => {
    if (window.google?.maps?.event) {
      window.google.maps.event.trigger(map, 'resize');
    }
  };
  return map;
}

export function destroyGoogleMap(map) {
  if (!map) return;
  (map.__markers || []).forEach((marker) => marker.setMap(null));
  (map.__infoWindows || []).forEach((iw) => iw.close());
  if (map.__container) map.__container.innerHTML = '';
}

/** @deprecated Use destroyGoogleMap */
export const destroyOsmMap = destroyGoogleMap;

/** Static location preview iframe — does not use Maps Embed API (only Maps JavaScript API for interactive maps). */
export function getGoogleEmbedUrl(lat, lng, zoom = 15) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!isValidCoord(latNum, lngNum)) return '';
  return `https://maps.google.com/maps?q=${latNum},${lngNum}&z=${zoom}&output=embed`;
}

export function getGoogleExternalUrl(lat, lng, zoom = 17) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return '';
  return `https://www.google.com/maps?q=${latNum},${lngNum}&z=${zoom}`;
}

/** @deprecated */
export const getOsmEmbedUrl = getGoogleEmbedUrl;
/** @deprecated */
export const getOsmExternalUrl = getGoogleExternalUrl;

function createCircleMarker(map, point, options = {}) {
  const color = options.color || getFamilyAvailabilityMapColor(point.familyAvailability);
  return new window.google.maps.Marker({
    map,
    position: toLatLng(point.latitude, point.longitude),
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: options.scale ?? 9,
      fillColor: color,
      fillOpacity: options.fillOpacity ?? 0.95,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
  });
}

/** Family map with availability-coloured markers (Google Maps). */
export async function buildFamilyGoogleMap(container, points = [], options = {}) {
  const {
    fullDetails = false,
    showMemberDetails,
    showEditButton = false,
  } = options;
  const includeMembers = showMemberDetails ?? fullDetails;
  if (!container) return null;

  await loadGoogleMapsScript();
  container.innerHTML = '';

  const validPoints = (points || []).filter((p) => isValidCoord(Number(p.latitude), Number(p.longitude)));

  const center = validPoints.length
    ? { lat: validPoints[0].latitude, lng: validPoints[0].longitude }
    : DEFAULT_CENTER;

  const map = createMap(container, center, validPoints.length ? 14 : 11);
  const markers = [];
  const infoWindows = [];

  validPoints.forEach((point) => {
    const marker = createCircleMarker(map, point);
    const infoWindow = new window.google.maps.InfoWindow({
      content: buildFamilyMapTooltipHtml(point, { showMemberDetails: includeMembers, showEditButton }),
      maxWidth: 360,
    });
    marker.addListener('click', () => {
      infoWindows.forEach((iw) => iw.close());
      infoWindow.open({ map, anchor: marker });
    });
    markers.push(marker);
    infoWindows.push(infoWindow);
  });

  fitMapToMarkers(map, markers);
  window.requestAnimationFrame(() => {
    window.google.maps.event.trigger(map, 'resize');
    fitMapToMarkers(map, markers);
  });

  return attachMapMeta(map, container, markers, infoWindows);
}

/** @deprecated */
export const buildFamilyOsmMap = buildFamilyGoogleMap;

/** Multiple points with custom colour + popup. */
export async function buildPointsGoogleMap(container, points = [], options = {}) {
  const {
    getColor = () => '#2563eb',
    getPopupHtml = () => '',
    defaultZoom = 13,
  } = options;

  if (!container) return null;
  await loadGoogleMapsScript();
  container.innerHTML = '';

  const validPoints = (points || []).filter((p) => isValidCoord(Number(p.latitude), Number(p.longitude)));

  const center = validPoints.length
    ? { lat: validPoints[0].latitude, lng: validPoints[0].longitude }
    : DEFAULT_CENTER;

  const map = createMap(container, center, defaultZoom);
  const markers = [];
  const infoWindows = [];

  validPoints.forEach((point) => {
    const marker = createCircleMarker(map, point, {
      color: getColor(point),
      scale: 7,
      fillOpacity: 0.9,
    });
    const html = getPopupHtml(point);
    if (html) {
      const infoWindow = new window.google.maps.InfoWindow({ content: html, maxWidth: 360 });
      marker.addListener('click', () => {
        infoWindows.forEach((iw) => iw.close());
        infoWindow.open({ map, anchor: marker });
      });
      infoWindows.push(infoWindow);
    }
    markers.push(marker);
  });

  fitMapToMarkers(map, markers);
  window.requestAnimationFrame(() => {
    window.google.maps.event.trigger(map, 'resize');
    fitMapToMarkers(map, markers);
  });

  return attachMapMeta(map, container, markers, infoWindows);
}

/** @deprecated */
export const buildPointsOsmMap = buildPointsGoogleMap;

/** Single draggable pin (booth / promotion location). */
export async function buildDraggableGoogleMap(container, options = {}) {
  const {
    lat = DEFAULT_CENTER.lat,
    lng = DEFAULT_CENTER.lng,
    zoom = 15,
    onPositionChange,
  } = options;

  if (!container) return { map: null, marker: null };

  await loadGoogleMapsScript();
  container.innerHTML = '';

  const map = createMap(container, { lat, lng }, zoom);
  const marker = new window.google.maps.Marker({
    map,
    position: toLatLng(lat, lng),
    draggable: true,
  });

  const emit = () => {
    const pos = marker.getPosition();
    if (pos) onPositionChange?.(pos.lat(), pos.lng());
  };

  marker.addListener('dragend', emit);
  attachMapMeta(map, container, [marker]);

  return { map, marker };
}

/** @deprecated */
export const buildDraggableOsmMap = buildDraggableGoogleMap;

/** Click to place pin; optional draggable pin. */
export async function buildClickableGoogleMap(container, options = {}) {
  const {
    lat = DEFAULT_CENTER.lat,
    lng = DEFAULT_CENTER.lng,
    zoom = 14,
    draggable = false,
    onPositionChange,
  } = options;

  if (!container) return { map: null, marker: null };

  await loadGoogleMapsScript();
  container.innerHTML = '';

  const map = createMap(container, { lat, lng }, zoom);
  let marker = new window.google.maps.Marker({
    map,
    position: toLatLng(lat, lng),
    draggable,
  });

  const emit = (pos) => {
    if (pos) onPositionChange?.(pos.lat(), pos.lng());
  };

  marker.addListener('dragend', () => emit(marker.getPosition()));

  map.addListener('click', (event) => {
    if (!event.latLng) return;
    if (!marker) {
      marker = new window.google.maps.Marker({
        map,
        position: event.latLng,
        draggable,
      });
      marker.addListener('dragend', () => emit(marker.getPosition()));
    } else {
      marker.setPosition(event.latLng);
    }
    emit(event.latLng);
  });

  const setPosition = (nextLat, nextLng) => {
    const position = toLatLng(nextLat, nextLng);
    marker.setPosition(position);
    map.panTo(position);
    onPositionChange?.(nextLat, nextLng);
  };

  attachMapMeta(map, container, [marker]);

  return { map, marker, setPosition };
}

/** @deprecated */
export const buildClickableOsmMap = buildClickableGoogleMap;

/** WebView HTML for React Native (Google Maps JavaScript API). */
export function buildGoogleWebViewHtml(lat, lng, options = {}) {
  const latN = Number(lat) || DEFAULT_CENTER.lat;
  const lngN = Number(lng) || DEFAULT_CENTER.lng;
  const zoom = options.zoom ?? 15;
  const draggable = Boolean(options.draggable);
  const clickable = Boolean(options.clickable);
  const key = getGoogleMapsApiKey();

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    function post(obj) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj));
    }
    function initMap() {
      var map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${latN}, lng: ${lngN} },
        zoom: ${zoom},
        streetViewControl: false
      });
      var marker = new google.maps.Marker({
        map: map,
        position: { lat: ${latN}, lng: ${lngN} },
        draggable: ${draggable}
      });
      function emit() {
        var p = marker.getPosition();
        post({ type: 'position', lat: p.lat(), lng: p.lng() });
      }
      if (${draggable}) marker.addListener('dragend', emit);
      if (${clickable}) {
        map.addListener('click', function(e) {
          marker.setPosition(e.latLng);
          post({ type: 'position', lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initMap"></script>
</body>
</html>`;
}

/** @deprecated */
export const buildOsmWebViewHtml = buildGoogleWebViewHtml;
