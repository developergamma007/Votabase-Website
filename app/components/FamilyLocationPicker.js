'use client';

import { useEffect, useRef, useState } from 'react';
import { LocationOnOutlined, PlaceOutlined } from '@mui/icons-material';
import { buildClickableOsmMap, destroyOsmMap } from '../lib/osmMap';

const DEFAULT_LAT = 12.9716;
const DEFAULT_LNG = 77.5946;

/**
 * Household location: large map for pin mark + separate GPS button (GPS asks before replacing a pin).
 */
export default function FamilyLocationPicker({
  location,
  onLocationChange,
  onCaptureGps,
  onPinMarkConfirm,
}) {
  const hostRef = useRef(null);
  const mapApiRef = useRef(null);
  const skipEmitRef = useRef(false);
  const pinMarkedRef = useRef(false);
  const [pinMarked, setPinMarked] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [pinStatus, setPinStatus] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');

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
          pinMarkedRef.current = true;
          setPinMarked(true);
          setPinStatus('');
          onLocationChange?.({
            latitude: nextLat,
            longitude: nextLng,
            accuracy: null,
            source: 'pin',
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
    if (location?.source === 'pin') {
      pinMarkedRef.current = true;
      setPinMarked(true);
    }
    if (location?.source === 'gps') {
      pinMarkedRef.current = false;
      setPinMarked(false);
    }
    skipEmitRef.current = true;
    mapApiRef.current.setPosition(lat, lng);
    if (location?.source === 'gps' && mapApiRef.current?.map?.setZoom) {
      mapApiRef.current.map.setZoom(18);
    }
    skipEmitRef.current = false;
  }, [location?.latitude, location?.longitude, location?.source]);

  const runGpsCapture = async () => {
    if (!onCaptureGps) return;
    setGpsLoading(true);
    setGpsStatus('');
    setPinStatus('');
    try {
      await onCaptureGps();
      pinMarkedRef.current = false;
      setPinMarked(false);
      setGpsStatus('GPS location captured. Map updated to your position.');
    } catch (err) {
      const msg = err?.message || 'Unable to capture GPS. Allow location permission and try again.';
      setGpsStatus(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleGps = async () => {
    if (!onCaptureGps) return;
    if (pinMarkedRef.current && hasCoords) {
      const ok = window.confirm(
        'GPS will replace your pin-marked household location. Continue with GPS?',
      );
      if (!ok) return;
    }
    await runGpsCapture();
  };

  const handlePinMark = () => {
    if (!hasCoords) {
      setPinStatus('Tap or drag on the map to place the pin first.');
      return;
    }
    pinMarkedRef.current = true;
    setPinMarked(true);
    onLocationChange?.({
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location?.accuracy ?? null,
      source: 'pin',
      confirmed: true,
    });
    setPinStatus('Household location saved from map pin.');
    onPinMarkConfirm?.();
  };

  const hasCoords =
    Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude));

  return (
    <div className="mobile-web-family-location-picker">
      <p className="mobile-web-muted mobile-web-family-location-hint">
        <strong>Option 1 — GPS:</strong> use your phone location.
        {' '}
        <strong>Option 2 — Pin mark:</strong> drag or tap the map, then tap Pin Mark.
      </p>
      <div
        ref={hostRef}
        className="mobile-web-map-card mobile-web-family-location-map"
        role="application"
        aria-label="Household location map"
      />
      {hasCoords ? (
        <p className="mobile-web-muted mobile-web-family-location-coords">
          {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
          {pinMarked || location?.source === 'pin' ? ' · Pin marked' : location?.source === 'gps' ? ' · GPS' : ''}
        </p>
      ) : (
        <p className="mobile-web-muted mobile-web-family-location-coords">
          No pin yet — drag/tap the map or use GPS.
        </p>
      )}
      {pinStatus ? <p className="mobile-web-family-location-pin-status">{pinStatus}</p> : null}
      {gpsStatus ? (
        <p className={`mobile-web-family-location-pin-status ${gpsStatus.includes('Unable') || gpsStatus.includes('denied') || gpsStatus.includes('permission') ? 'mobile-web-family-location-gps-error' : ''}`}>
          {gpsStatus}
        </p>
      ) : null}
      <div className="mobile-web-family-location-actions">
        {onCaptureGps ? (
          <button
            type="button"
            className="mobile-web-location-btn mobile-web-location-btn-gps"
            onClick={handleGps}
            disabled={gpsLoading}
          >
            <LocationOnOutlined />
            <span>{gpsLoading ? 'Capturing GPS…' : 'Capture Household Location (GPS)'}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="mobile-web-location-btn mobile-web-location-btn-pin"
          onClick={handlePinMark}
        >
          <PlaceOutlined />
          <span>Capture Household Location (Pin Mark)</span>
        </button>
      </div>
    </div>
  );
}
