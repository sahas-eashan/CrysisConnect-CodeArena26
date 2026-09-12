import exifr from "exifr";
import { distanceM } from "./engine";
import type { GeoPoint } from "./types";

export type PhotoMetadata = {
  status: "gps_matches" | "gps_mismatch" | "gps_missing" | "gps_unchecked" | "unreadable";
  gps?: GeoPoint;
  distanceFromReportM?: number;
  /** UTC time is present only when EXIF supplies a valid explicit UTC offset. */
  capturedAt?: string;
  capturedAtRaw?: string;
  camera?: string;
  reason: string;
};

export const PHOTO_GPS_TOLERANCE_M = 150;

function boundedText(value: unknown, max = 160): string | undefined {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || undefined : undefined;
}

function captureTime(raw: unknown, offset: unknown): Pick<PhotoMetadata, "capturedAt" | "capturedAtRaw"> {
  const capturedAtRaw = boundedText(raw, 50);
  if (!capturedAtRaw) return {};
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(capturedAtRaw);
  const zone = typeof offset === "string" && /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset) && !/^[+-]14:(?!00)/.test(offset) ? offset : undefined;
  if (!match || !zone) return { capturedAtRaw };
  const [, year, month, day, hour, minute, second] = match;
  const wallClock = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (!Number.isFinite(wallClock.getTime()) || wallClock.toISOString().slice(0, 19) !== `${year}-${month}-${day}T${hour}:${minute}:${second}`) return { capturedAtRaw };
  const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`);
  return Number.isFinite(parsed) ? { capturedAtRaw, capturedAt: new Date(parsed).toISOString() } : { capturedAtRaw };
}

/** Parse only the EXIF block extracted by the server's bounded image decoder. Never accepts client metadata. */
export async function extractPhotoMetadata(exif: Buffer | undefined, location?: GeoPoint): Promise<PhotoMetadata> {
  const limitation = "EXIF fields can be edited; a match is consistency evidence, not proof of authenticity.";
  if (!exif?.length) return { status: "gps_missing", reason: `No embedded EXIF GPS is available. ${limitation}` };
  try {
    const tiff = exif.subarray(0, 6).equals(Buffer.from("Exif\0\0", "ascii")) ? exif.subarray(6) : exif;
    // silentErrors is supported at runtime but omitted by exifr's published declarations.
    const options = {
      pick: ["GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef", "DateTimeOriginal", "OffsetTimeOriginal", "Make", "Model"],
      reviveValues: false, silentErrors: false, makerNote: false, userComment: false, xmp: false, icc: false, iptc: false,
    };
    const metadata = await exifr.parse(tiff, options) as Record<string, unknown> | undefined;
    const timestamp = captureTime(metadata?.DateTimeOriginal, metadata?.OffsetTimeOriginal);
    const camera = [boundedText(metadata?.Make), boundedText(metadata?.Model)].filter(Boolean).join(" ").slice(0, 160) || undefined;
    const fields = { ...timestamp, camera };
    const latitude = metadata?.latitude, longitude = metadata?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !["N", "S"].includes(String(metadata?.GPSLatitudeRef)) || !["E", "W"].includes(String(metadata?.GPSLongitudeRef))) {
      const hasGPS = metadata && ["GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"].some(key => metadata[key] !== undefined);
      return { ...fields, status: hasGPS ? "unreadable" : "gps_missing", reason: `${hasGPS ? "The embedded GPS fields are incomplete or invalid." : "The photograph has no embedded GPS coordinates."} ${limitation}` };
    }
    const gps = { latitude, longitude };
    if (!location) return { ...fields, gps, status: "gps_unchecked", reason: `Embedded GPS was extracted, but no report location was supplied for comparison. ${limitation}` };
    const distance = distanceM(gps, location);
    return { ...fields, gps, distanceFromReportM: Math.round(distance), status: distance <= PHOTO_GPS_TOLERANCE_M ? "gps_matches" : "gps_mismatch",
      reason: `${distance <= PHOTO_GPS_TOLERANCE_M ? "Embedded GPS is consistent with" : "Embedded GPS conflicts with"} the report location (${Math.round(distance)} m apart; tolerance ${PHOTO_GPS_TOLERANCE_M} m). ${limitation}${timestamp.capturedAtRaw && !timestamp.capturedAt ? " Capture time has no usable UTC offset; its timezone is unknown." : ""}` };
  } catch { return { status: "unreadable", reason: `Embedded EXIF could not be parsed; location and capture time remain unverified. ${limitation}` }; }
}
