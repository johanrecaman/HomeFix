// src/hooks/useLocationSync.js
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { haversineDistance } from '../lib/geo';

/**
 * Watches the device position while isOnline is true.
 * Only writes to DB if the device moved > 50 metres since the last update.
 * Clears the watch and stops on cleanup / when isOnline becomes false.
 */
export function useLocationSync(isOnline, userId) {
  const watchId = useRef(null);
  const lastPos = useRef(null);

  useEffect(() => {
    if (!isOnline || !userId) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        lastPos.current = null;
      }
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        if (lastPos.current) {
          const moved = haversineDistance(
            lastPos.current.lat,
            lastPos.current.lng,
            lat,
            lng
          );
          if (moved < 50) return;
        }
        lastPos.current = { lat, lng };
        await supabase
          .from('prestadores')
          .update({
            last_location: `SRID=4326;POINT(${lng} ${lat})`,
            latitude: lat,
            longitude: lng,
          })
          .eq('user_id', userId);
      },
      (err) => console.error('useLocationSync error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, [isOnline, userId]);
}
