"use client";

import { useCallback, useState } from "react";
import { saveMyLocation } from "@/lib/aws/profile";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export function useGeolocation() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setError(null);
        setLoading(false);
        void saveMyLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
          .catch((saveError) => setError(saveError instanceof Error ? saveError.message : "Unable to save your location for area alerts."));
      },
      (positionError) => {
        setError(positionError.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000
      }
    );
  }, []);

  return { coordinates, error, loading, requestLocation };
}
