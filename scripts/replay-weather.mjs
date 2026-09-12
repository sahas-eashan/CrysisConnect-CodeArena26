import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = new URL(option("--base", "http://127.0.0.1:3000"));
const interval = Number(option("--interval", "1500"));
if (!Number.isFinite(interval) || interval < 0 || interval > 60000) throw new Error("--interval must be 0–60000 milliseconds.");
const token = process.env.HAZARD_REPLAY_TOKEN;
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !token) {
  throw new Error("Remote replay requires HAZARD_REPLAY_TOKEN containing an authorized government Cognito ID token.");
}

console.log("Replaying SIMULATED Kelani gauge readings; this creates demo in-app warnings.");
for (const scenario of ["normal", "normal", "flood"]) {
  const response = await fetch(new URL("/api/hazards", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : { "x-demo-role": "government" }) },
    body: JSON.stringify({ action: "replay", input: { scenario } })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Replay failed: ${response.status}`);
  console.log(`${scenario}: reading accepted${result?.id ? ` (${result.id})` : ""}`);
  if (scenario !== "flood") await delay(interval);
}
console.log("Replay complete. Review the weather warning in /admin/hazards and /citizen/hazards.");
