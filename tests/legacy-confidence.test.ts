import assert from "node:assert/strict";
import test from "node:test";
import { modelConfidence, confidenceProvenance, confidenceWarning } from "../lambda/ai/confidence.js";

test("accepts only finite model-reported probabilities, including both bounds", () => {
  for (const value of [0, 0.31, 1]) assert.equal(modelConfidence({ confidence: value }), value);
  for (const value of [null, undefined, "0.84", NaN, Infinity, -0.01, 1.01, {}, []]) {
    assert.equal(modelConfidence({ confidence: value }), null);
  }
  assert.equal(modelConfidence(null), null);
  assert.equal(modelConfidence({}), null);
});

test("distinguishes unavailable confidence and uncalibrated model estimates", () => {
  assert.equal(confidenceProvenance(null), "unavailable");
  assert.equal(confidenceProvenance(0), "model_estimate_uncalibrated");
  assert.match(confidenceWarning(0.8), /not been calibrated/);
  assert.match(confidenceWarning(null), /did not return a valid/);
  assert.match(confidenceWarning(null, true), /generation was blocked/);
});
