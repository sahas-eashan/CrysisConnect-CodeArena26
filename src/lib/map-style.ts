import type { StyleSpecification } from "maplibre-gl";

export const openStreetMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors"
    }
  },
  layers: [
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap"
    }
  ]
};
