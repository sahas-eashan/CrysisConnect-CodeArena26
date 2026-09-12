import { AuthError } from "@/lib/server-auth";
import { isIP } from "node:net";

const MAX_BODY_BYTES = 6 * 1024 * 1024;

export async function readHazardBody(request: Request): Promise<{ action: string; input: Record<string, unknown> }> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new AuthError("Send JSON content.", 415);
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new AuthError("Upload must be smaller than 6 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError("Request body is required.", 400);
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AuthError("Upload must be smaller than 6 MB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AuthError("Malformed JSON.", 400); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AuthError("Invalid request.", 400);
  const { action, input } = parsed as Record<string, unknown>;
  if (typeof action !== "string" || action.length > 64 || !input || typeof input !== "object" || Array.isArray(input) || Object.keys(parsed).some(key => !["action", "input"].includes(key))) {
    throw new AuthError("An action and input object are required.", 400);
  }
  return { action, input: input as Record<string, unknown> };
}

// A per-process abuse guard; use a shared rate limiter when running several web replicas.
const windows = new Map<string, { start: number; count: number }>();
export function limitHazardAction(actorId: string, action: string) {
  const now = Date.now();
  for (const [key, value] of windows) if (now - value.start >= 60_000) windows.delete(key);
  const key = `${actorId}:${action}`;
  const window = windows.get(key) ?? { start: now, count: 0 };
  const limit = action === "publicReadAggregate" ? 1200 : action === "publicRead" ? 120 : ["report", "evidence", "close", "route", "screenRoute", "confirmCommunity", "requestCommunity", "banReporter", "unbanReporter", "assignCouncil", "autoRelief"].includes(action) ? 12 : 60;
  if (window.count >= limit) throw new AuthError("Too many requests. Please wait a minute and retry.", 429);
  window.count += 1;
  windows.set(key, window);
}

export function limitPublicHazardRead(request: Request) {
  // Forwarded IPs are only an abuse hint, never an authenticated identity. The aggregate
  // window bounds requests even when clients can forge or rotate forwarding headers.
  limitHazardAction("anonymous", "publicReadAggregate");
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  const address = forwarded.length <= 64 && isIP(forwarded) ? forwarded : "unknown";
  limitHazardAction(`public:${address}`, "publicRead");
}
