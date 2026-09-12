"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, LngLatLike, Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { openStreetMapStyle } from "@/lib/map-style";
import { configureMapClient } from "@/lib/map-client";
import type { MapMarker } from "@/lib/types";
import { parseGeoJsonPoint } from "@/lib/utils";

type MapViewProps = {
  center?: LngLatLike;
  zoom?: number;
  markers?: MapMarker[];
  polygons?: string[];
  route?: [number, number][];
  className?: string;
};

export function MapView({
  center = [79.8612, 6.9271],
  zoom = 11,
  markers = [],
  polygons = [],
  route = [],
  className = ""
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const initialView = useRef({ center, zoom });
  const { lng: centerLongitude, lat: centerLatitude } = maplibregl.LngLat.convert(center);

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

    let map: Map;
    try {
      configureMapClient();
      map = new maplibregl.Map({
        container: mapRef.current,
        style: openStreetMapStyle,
        center: initialView.current.center,
        zoom: initialView.current.zoom
      });
    } catch {
      setMapLoading(false);
      setMapError("This browser could not start the interactive map. Try a current browser with graphics acceleration enabled. Case details and alerts remain available.");
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", () => { setMapLoading(false); setMapError("Some map layers could not load. Check your connection; case details and alerts are still available."); });
    map.once("idle", () => setMapLoading(false));
    instanceRef.current = map;
    // Grid layout, sidebar changes and asynchronous styles can resize the map
    // without a window resize. Keep the WebGL canvas and marker projection aligned.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapRef.current);

    return () => {
      resizeObserver.disconnect();
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.jumpTo({ center: [centerLongitude, centerLatitude], zoom });
  }, [centerLongitude, centerLatitude, zoom]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;

    const markerInstances: maplibregl.Marker[] = [];
    markers.forEach((marker) => {
      const popup = new maplibregl.Popup({
            offset: 12,
            closeButton: false,
            closeOnClick: false,
            className: "cc-map-popup"
          });
      if (marker.popup) popup.setHTML(marker.popup);
      else popup.setText(marker.label);
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
    return () => { map.off("load", upsert); };
  }, [normalizedPolygons]);

  useEffect(() => {
    const map = instanceRef.current;
    if (!map) return;
    const data = {
      type: "FeatureCollection",
      features: route.length > 1 ? [{
        type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route }
      }] : []
    };
    const upsert = () => {
      const source = map.getSource("screened-route") as GeoJSONSource | undefined;
      if (source) { source.setData(data as never); return; }
      map.addSource("screened-route", { type: "geojson", data: data as never });
      map.addLayer({ id: "screened-route-line", type: "line", source: "screened-route", paint: { "line-color": "#38bdf8", "line-width": 5 } });
    };
    if (map.isStyleLoaded()) upsert();
    else map.once("load", upsert);
    return () => { map.off("load", upsert); };
  }, [route]);

  return <div className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-800 ${className}`}>
    <div style={{ position: "absolute", inset: 0 }} ref={mapRef} />
    {mapLoading ? <p className="absolute bottom-10 left-3 rounded-lg bg-slate-950/95 p-2 text-xs text-slate-200" role="status">Loading street map…</p> : null}
    {mapError ? <p className="absolute bottom-10 left-3 right-3 rounded-lg border border-amber-700/50 bg-slate-950/95 p-2 text-xs text-amber-200" role="status">{mapError}</p> : null}
  </div>;
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
        // MapView renders this label as text, so user supplied names cannot inject HTML.
      } satisfies MapMarker;
    })
    .filter(Boolean) as MapMarker[];
}
