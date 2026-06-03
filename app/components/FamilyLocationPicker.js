'use client';

import { useEffect, useRef, useState } from 'react';
import { LocationOnOutlined } from '@mui/icons-material';
import { buildClickableOsmMap, destroyOsmMap } from '../lib/osmMap';

const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

/**
 * Interactive household location picker: drag pin or tap map; optional GPS capture.
 */
export default function FamilyLocationPicker({
  location,
  onLocationChange,
  onCaptureGps,
  captureLabel = 'Capture Household Location (GPS)',
  hint = 'Drag the pin or tap on the map to set the exact household location. You can also use GPS.',
}) {
  const hostRef = useRef(null);
  const mapApiRef = useRef(null);
  const skipEmitRef = useRef(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hostRef.current) return;
      destroyOsmMap(mapApiRef.current?.map);
      const lat = Number(location?.latitude);
      const lng = Number(location?.longitude);
      const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
      const api = await buildClickableOsmMap(hostRef.current, {
        lat: hasPin ? lat : DEFAULT_LAT,
        lng: hasPin ? lng : DEFAULT_LNG,
        zoom: hasPin ? 18 : 14,
        draggable: true,
        onPositionChange: (nextLat, nextLng) => {
          if (skipEmitRef.current) return;
          onLocationChange?.({
            latitude: nextLat,
            longitude: nextLng,
            accuracy: location?.accuracy ?? null,
          });
        },
      });
      if (!cancelled) mapApiRef.current = api;
    })();
    return () => {
      cancelled = true;
      destroyOsmMap(mapApiRef.current?.map);
      mapApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lat = Number(location?.latitude);
    const lng = Number(location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !mapApiRef.current?.setPosition) return;
    skipEmitRef.current = true;
    mapApiRef.current.setPosition(lat, lng);
    skipEmitRef.current = false;
  }, [location?.latitude, location?.longitude]);

  const handleGps = async () => {
    if (!onCaptureGps) return;
    setGpsLoading(true);
    try {
      await onCaptureGps();
    } finally {
      setGpsLoading(false);
    }
  };

  const hasCoords =
    Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));

  return (
    <div className="mobile-web-family-location-picker">
      <p className="mobile-web-muted mobile-web-family-location-hint">{hint}</p>
      <div ref={hostRef} className="mobile-web-map-card mobile-web-family-location-map" role="application" aria-label="Household location map" />
      {hasCoords ? (
        <p className="mobile-web-muted mobile-web-family-location-coords">
          {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
        </p>
      ) : (
        <p className="mobile-web-muted mobile-web-family-location-coords">No pin placed yet — drag or tap the map.</p>
      )}
      {onCaptureGps ? (
        <button
          type="button"
          className="mobile-web-location-btn w-full"
          onClick={handleGps}
          disabled={gpsLoading}
        >
          <LocationOnOutlined />
          <span>{gpsLoading ? 'Capturing GPS…' : captureLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
