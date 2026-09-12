"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { openStreetMapStyle } from "@/lib/map-style";
import { configureMapClient } from "@/lib/map-client";
import { Button } from "@/components/ui/button";

type DrawPoint = [number, number];

function toPolygon(points: DrawPoint[]) {
  if (points.length < 3) return null;
  const closed = [...points, points[0]];
  return {
    type: "Polygon",
    coordinates: [closed]
  };
}

export function MapDraw({
  onGeometryChange
}: {
  onGeometryChange?: (geojson: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [points, setPoints] = useState<DrawPoint[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: Map;
    try {
      configureMapClient();
      map = new maplibregl.Map({
        container: containerRef.current,
        style: openStreetMapStyle,
        center: [79.8612, 6.9271],
        zoom: 12
      });
    } catch {
      setMapError("This browser could not start the drawing map. Enable graphics acceleration or use another browser before drawing an affected area.");
      return;
    }

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", () => setMapError("Some map layers could not load. Check your connection before marking an affected area."));
    map.on("click", (event) => {
      setPoints((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
    });

    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "drawn-geometry";
    const polygon = toPolygon(points);
    const data = {
      type: "FeatureCollection",
      features: [
        ...points.map((point, index) => ({
          type: "Feature",
          id: `point-${index}`,
          properties: {},
          geometry: { type: "Point", coordinates: point }
        })),
        ...(polygon
          ? [
              {
                type: "Feature",
                id: "polygon",
                properties: {},
                geometry: polygon
              }
            ]
          : [])
      ]
    };

    const upsert = () => {
      const source = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data as never);
      } else {
        map.addSource(sourceId, { type: "geojson", data: data as never });
        map.addLayer({
          id: "drawn-fill",
          type: "fill",
          source: sourceId,
          filter: ["==", "$type", "Polygon"],
          paint: { "fill-color": "#f59e0b", "fill-opacity": 0.25 }
        });
        map.addLayer({
          id: "drawn-line",
          type: "line",
          source: sourceId,
          filter: ["==", "$type", "Polygon"],
          paint: { "line-color": "#f59e0b", "line-width": 2 }
        });
        map.addLayer({
          id: "drawn-points",
          type: "circle",
          source: sourceId,
          filter: ["==", "$type", "Point"],
          paint: { "circle-radius": 5, "circle-color": "#38bdf8" }
        });
      }
    };

    if (map.isStyleLoaded()) upsert();
    else map.once("load", upsert);

    if (polygon && onGeometryChange) {
      onGeometryChange(JSON.stringify(polygon));
    }
    return () => { map.off("load", upsert); };
  }, [onGeometryChange, points]);

  return (
    <div className="space-y-3">
      <div
        className="aspect-square w-full overflow-hidden rounded-2xl border border-slate-800"
        ref={containerRef}
      />
      {mapError ? <p className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200" role="status">{mapError}</p> : null}
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <p>Click on the map to add polygon points. After the third point, the affected area closes automatically.</p>
        <Button onClick={() => setPoints([])} variant="outline">
          Reset drawing
        </Button>
      </div>
    </div>
  );
}
