import { z } from "zod";
import sharp from "sharp";
import { extractPhotoMetadata, type PhotoMetadata } from "./photo-metadata";
import type { GeoPoint } from "./types";

export class HazardError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "INVALID_INPUT") {
    super(message);
    this.name = "HazardError";
  }
}

export const pointSchema = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict();
export const routeCoordinatesSchema = z.array(z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)])).min(2).max(20_000);
export const actorSchema = z.object({ id: z.string().trim().min(1).max(200), role: z.enum(["citizen", "ngo", "government", "relief"]), name: z.string().max(200).optional(), councilIds: z.array(z.string().min(1).max(100)).max(50).optional() });
export const photoSchema = z.object({ dataUrl: z.string().max(2_800_000), capturedAt: z.string().datetime({ offset: true }).optional() }).strict();
export const reportSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(4000),
  kind: z.enum(["flood", "landslide", "storm", "tsunami", "fire", "blocked_road", "fallen_tree", "other"]),
  location: pointSchema,
  photo: photoSchema,
  helpRequested: z.boolean().optional().default(false),
  needs: z.string().trim().max(1000).optional().default(""),
}).strict();
export const weatherSchema = z.object({
  stationId: z.string().trim().min(2).max(100), location: pointSchema,
  rainfallMm: z.number().finite().min(0).max(3000), waterLevelM: z.number().finite().min(0).max(100),
  dangerLevelM: z.number().finite().positive().max(100), observedAt: z.string().datetime({ offset: true }),
}).strict();
export const crewSchema = z.object({ id: z.string().trim().min(1).max(200), name: z.string().trim().min(2).max(160) }).strict();
export const notesSchema = z.string().trim().min(5).max(2000);
export const reliefSchema = z.object({
  organization: z.string().trim().min(2).max(160), resources: z.string().trim().min(3).max(2000),
  shelterId: z.string().trim().min(1).max(200).optional(), people: z.number().int().min(1).max(1000).optional(),
}).strict().refine(value => Boolean(value.shelterId) === Boolean(value.people), { message: "Supply both shelterId and people for a shelter allocation." });

export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HazardError(result.error.issues.map(issue => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "));
  return result.data;
}

/** Validate content bytes as well as the declared MIME type. SVG/remote URLs are never accepted. */
export async function validatePhoto(value: unknown, location?: GeoPoint): Promise<{ dataUrl: string; mimeType: string; capturedAt?: string; metadata: PhotoMetadata }> {
  const input = parse(photoSchema, value);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.dataUrl);
  if (!match || match[2].length % 4 !== 0) throw new HazardError("Photo must be a JPEG, PNG or WebP base64 data URL.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 12 || bytes.length > 2 * 1024 * 1024) throw new HazardError("Photo must contain an image no larger than 2 MiB.");
  if (bytes.toString("base64") !== match[2]) throw new HazardError("Photo contains malformed base64 data.");
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(12, 16).toString("ascii") === "IHDR";
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!(match[1] === "image/png" && isPng || match[1] === "image/jpeg" && isJpeg || match[1] === "image/webp" && isWebp)) throw new HazardError("Photo content does not match its declared image type.");
  if (input.capturedAt && Date.parse(input.capturedAt) > Date.now() + 5 * 60_000) throw new HazardError("Photo capture time cannot be in the future.");
  let exif: Buffer | undefined;
  try {
    // Headers alone are not proof of a photograph. Force pixel decoding with bounded dimensions.
    const image = sharp(bytes, { limitInputPixels: 24_000_000, failOn: "warning", sequentialRead: true });
    const metadata = await image.metadata();
    exif = metadata.exif;
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("Invalid or animated image.");
    await image.resize(1, 1, { fit: "fill" }).raw().toBuffer();
  } catch { throw new HazardError("Photo could not be decoded. Upload a complete, static JPEG, PNG or WebP image of at most 24 megapixels."); }
  return { ...input, mimeType: match[1], metadata: await extractPhotoMetadata(exif, location) };
}
