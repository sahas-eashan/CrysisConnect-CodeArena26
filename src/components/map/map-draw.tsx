"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { openStreetMapStyle } from "@/lib/map-style";
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: openStreetMapStyle,
      center: [79.8612, 6.9271],
      zoom: 12
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("click", (event) => {
      setPoints((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
    });

    mapRef.current = map;

    return () => {
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
  }, [onGeometryChange, points]);

  return (
    <div className="space-y-3">
      <div
        className="aspect-square w-full overflow-hidden rounded-2xl border border-slate-800"
        ref={containerRef}
      />
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <p>Click on the map to add polygon points. After the third point, the affected area closes automatically.</p>
        <Button onClick={() => setPoints([])} variant="outline">
          Reset drawing
        </Button>
      </div>
    </div>
  );
}
