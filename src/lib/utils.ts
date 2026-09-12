import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistanceMeters(distance?: number | null) {
  if (distance == null) return "Unknown";
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

export function toTitleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseGeoJsonPoint(point?: string | null) {
  if (!point) return null;
  try {
    const parsed = JSON.parse(point);
    if (parsed.type !== "Point" || !Array.isArray(parsed.coordinates)) return null;
    return {
      longitude: Number(parsed.coordinates[0]),
      latitude: Number(parsed.coordinates[1])
    };
  } catch {
    return null;
  }
}
