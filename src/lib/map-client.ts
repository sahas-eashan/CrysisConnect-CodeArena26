"use client";

import { setWorkerUrl } from "maplibre-gl";

let configured = false;

export function configureMapClient() {
  if (configured) return;
  // Next.js must serve the worker and its shared module together. The matching
  // installed files are copied to public/maplibre by predev and prebuild.
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  configured = true;
}
