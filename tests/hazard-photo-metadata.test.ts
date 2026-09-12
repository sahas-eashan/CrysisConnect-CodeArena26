import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { extractPhotoMetadata } from "../src/lib/hazards/photo-metadata";
import { validatePhoto } from "../src/lib/hazards/validation";

const point = { latitude: 6.952, longitude: 79.88 };
async function photograph(format: "jpeg" | "png" | "webp", gps = true, offset?: string) {
  const exif: Record<string, Record<string, string>> = {
    IFD0: { Make: "TEST Camera", Model: "Synthetic fixture" },
    IFD2: { DateTimeOriginal: "2026:09:12 10:00:00", ...(offset ? { OffsetTimeOriginal: offset } : {}) },
  };
  if (gps) exif.IFD3 = { GPSLatitudeRef: "N", GPSLatitude: "6/1 57/1 72/10", GPSLongitudeRef: "E", GPSLongitude: "79/1 52/1 48/1" };
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } }).withExif(exif).toFormat(format).toBuffer();
  return { dataUrl: `data:image/${format};base64,${bytes.toString("base64")}` };
}

test("the server extracts actual embedded GPS, camera and offset-aware capture time from JPEG, PNG and WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const photo = await validatePhoto(await photograph(format, true, "+05:30"), point);
    assert.equal(photo.metadata.status, "gps_matches", format);
    assert.deepEqual(photo.metadata.gps, point, format);
    assert.equal(photo.metadata.distanceFromReportM, 0);
    assert.equal(photo.metadata.camera, "TEST Camera Synthetic fixture");
    assert.equal(photo.metadata.capturedAt, "2026-09-12T04:30:00.000Z");
    assert.match(photo.metadata.reason, /not proof of authenticity/);
  }
});

test("photo location mismatch is persisted while an unzoned camera time remains explicitly unconverted", async () => {
  const photo = await validatePhoto(await photograph("jpeg"), { latitude: 7.2, longitude: 80.1 });
  assert.equal(photo.metadata.status, "gps_mismatch");
  assert.ok(photo.metadata.distanceFromReportM! > 30_000);
  assert.equal(photo.metadata.capturedAt, undefined);
  assert.equal(photo.metadata.capturedAtRaw, "2026:09:12 10:00:00");
  assert.match(photo.metadata.reason, /timezone is unknown/);
});

test("missing GPS, absent EXIF and malformed EXIF remain unknown instead of becoming location matches", async () => {
  const withoutGPS = await validatePhoto(await photograph("jpeg", false), point);
  assert.equal(withoutGPS.metadata.status, "gps_missing");
  assert.equal(withoutGPS.metadata.gps, undefined);
  assert.equal(withoutGPS.metadata.camera, "TEST Camera Synthetic fixture");
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#abcdef" } }).png().toBuffer();
  const withoutEXIF = await validatePhoto({ dataUrl: `data:image/png;base64,${bytes.toString("base64")}` }, point);
  assert.equal(withoutEXIF.metadata.status, "gps_missing");
  assert.equal((await extractPhotoMetadata(Buffer.from("Exif\0\0broken"), point)).status, "unreadable");
});

test("client-declared EXIF fields are rejected and client capture times never replace embedded timestamps", async () => {
  const input = await photograph("jpeg", true, "+05:30");
  await assert.rejects(validatePhoto({ ...input, metadata: { status: "gps_matches", gps: point } }, point), /Unrecognized key/);
  const photo = await validatePhoto({ ...input, capturedAt: "2026-09-11T00:00:00Z" }, point);
  assert.equal(photo.capturedAt, "2026-09-11T00:00:00Z");
  assert.equal(photo.metadata.capturedAt, "2026-09-12T04:30:00.000Z");
});
