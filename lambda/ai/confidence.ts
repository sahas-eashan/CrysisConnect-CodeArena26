/** A model self-report is an estimate, never a calibrated probability. */
export function modelConfidence(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { confidence?: unknown }).confidence;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function confidenceProvenance(confidence: number | null) {
  return confidence === null ? "unavailable" : "model_estimate_uncalibrated";
}

export function confidenceWarning(confidence: number | null, blocked = false) {
  if (blocked) return "Confidence unavailable: model generation was blocked; fallback text is not a model assessment.";
  return confidence === null
    ? "Confidence unavailable: the model did not return a valid numeric estimate between 0 and 1."
    : "Confidence is the model's self-reported estimate and has not been calibrated against real outcomes.";
}
