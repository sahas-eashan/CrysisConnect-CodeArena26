"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { GeoJSONSource, LngLatLike, Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { openStreetMapStyle } from "@/lib/map-style";
import type { MapMarker } from "@/lib/types";
import { parseGeoJsonPoint } from "@/lib/utils";

type MapViewProps = {
  center?: LngLatLike;
  zoom?: number;
  markers?: MapMarker[];
  polygons?: string[];
  className?: string;
};

export function MapView({
  center = [79.8612, 6.9271],
  zoom = 11,
  markers = [],
  polygons = [],
  className = ""
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Map | null>(null);

  const normalizedPolygons = useMemo(
    () =>
      polygons
        .map((polygon) => {
          try {
            return JSON.parse(polygon);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as Record<string, unknown>[],
    [polygons]
  );

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: openStreetMapStyle,
      center,
      zoom
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    instanceRef.current = map;

    return () => {
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const markerInstances: maplibregl.Marker[] = [];
    markers.forEach((marker) => {
      const popup = marker.popup
        ? new maplibregl.Popup({
            offset: 12,
            closeButton: false,
            closeOnClick: false,
            className: "cc-map-popup"
          }).setHTML(marker.popup)
        : undefined;
      const markerElement = document.createElement("div");
      markerElement.className = "flex flex-col items-center gap-2";
      markerElement.title = marker.label;

      if (marker.variant === "label") {
        const labelElement = document.createElement("div");
        labelElement.className =
          "whitespace-nowrap rounded-full border border-red-400/40 bg-red-950/95 px-3 py-1 text-center text-xs font-semibold leading-tight text-red-50 shadow-lg";
        labelElement.textContent = marker.label;
        markerElement.appendChild(labelElement);
      } else if (marker.variant === "info") {
        const infoElement = document.createElement("div");
        infoElement.className =
          "flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-[11px] font-bold text-white shadow-lg";
        infoElement.textContent = "i";
        markerElement.appendChild(infoElement);
      } else {
        const pinElement = document.createElement("div");
        pinElement.className = "h-4 w-4 rounded-full border-2 border-white shadow-lg";
        pinElement.style.backgroundColor = marker.color ?? "#38bdf8";
        markerElement.appendChild(pinElement);
      }

      const markerInstance = new maplibregl.Marker({ element: markerElement }).setLngLat([marker.longitude, marker.latitude]);
      if (popup) markerInstance.setPopup(popup);
      markerInstance.addTo(map);

      if (popup) {
        markerElement.addEventListener("mouseenter", () => {
          popup.setLngLat([marker.longitude, marker.latitude]).addTo(map);
        });
        markerElement.addEventListener("mouseleave", () => {
          popup.remove();
        });
      }

      markerInstances.push(markerInstance);
    });

    return () => {
      markerInstances.forEach((marker) => marker.remove());
    };
  }, [markers]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const sourceId = "incident-polygons";
    const featureCollection = {
      type: "FeatureCollection",
      features: normalizedPolygons.map((geometry, index) => ({
        type: "Feature",
        id: index,
        properties: {},
        geometry
      }))
    };

    const upsert = () => {
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(featureCollection as never);
        return;
      }

      map.addSource(sourceId, {
        type: "geojson",
        data: featureCollection as never
      });
      map.addLayer({
        id: "incident-polygons-fill",
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.2
        }
      });
      map.addLayer({
        id: "incident-polygons-outline",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#ef4444",
          "line-width": 2
        }
      });
    };

    if (map.isStyleLoaded()) upsert();
    else map.once("load", upsert);
  }, [normalizedPolygons]);

  return <div className={`aspect-square w-full overflow-hidden rounded-2xl border border-slate-800 ${className}`} ref={mapRef} />;
}

export function markersFromPoints(points: { id: string; name: string; location?: string | null; color?: string }[]) {
  return points
    .map((point) => {
      const parsed = parseGeoJsonPoint(point.location);
      if (!parsed) return null;
      return {
        id: point.id,
        label: point.name,
        longitude: parsed.longitude,
        latitude: parsed.latitude,
        color: point.color,
        popup: `<div style="color:#f8fafc;font-weight:600;font-size:14px;line-height:1.3;">${point.name}</div>`
      } satisfies MapMarker;
    })
    .filter(Boolean) as MapMarker[];
}
