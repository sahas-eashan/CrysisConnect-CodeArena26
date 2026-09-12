import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(require.resolve("maplibre-gl/package.json"));
const destination = path.join(process.cwd(), "public", "maplibre");
mkdirSync(destination, { recursive: true });

// The worker imports the shared module by relative path. Keep both files from
// the exact installed version together for Next.js dev and production builds.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(packageDirectory, "dist", file), path.join(destination, file));
}
