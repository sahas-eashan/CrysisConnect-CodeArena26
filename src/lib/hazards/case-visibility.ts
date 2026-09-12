import type { HazardActor, HazardCase } from "./types";

/** Apply the same case-detail policy to reads and mutation responses. Never alter stored evidence. */
export function caseForActor(item: HazardCase, actor: HazardActor): HazardCase {
  return actor.role === "relief" ? { ...item, evidence: [], checks: [] } : item;
}
