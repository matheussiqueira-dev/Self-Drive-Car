/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRunPayload, ALLOWED_REASONS } = require("../src/validator");

function baseRun() {
  return {
    generation: 4,
    bestDistance: 934,
    averageFitness: 120.42,
    alivePeak: 100,
    durationMs: 42000,
    reason: "manual",
    endedAt: new Date().toISOString(),
    config: { population: 100, trafficCount: 50, mutationRate: 0.1, laneCount: 3 },
  };
}

test("accepts a valid payload", () => {
  const result = parseRunPayload(baseRun());
  assert.equal(result.ok, true);
  assert.equal(result.value.generation, 4);
  assert.equal(result.value.config.population, 100);
});

test("rejects null payload", () => {
  const result = parseRunPayload(null);
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("object"));
});

test("rejects non-object payload", () => {
  const result = parseRunPayload("string");
  assert.equal(result.ok, false);
});

test("rejects generation = 0 (below minimum)", () => {
  const result = parseRunPayload({ ...baseRun(), generation: 0 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("generation")));
});

test("rejects generation > 1000000", () => {
  const result = parseRunPayload({ ...baseRun(), generation: 1000001 });
  assert.equal(result.ok, false);
});

test("rejects bestDistance < 0", () => {
  const result = parseRunPayload({ ...baseRun(), bestDistance: -1 });
  assert.equal(result.ok, false);
});

test("rejects non-finite averageFitness", () => {
  const result = parseRunPayload({ ...baseRun(), averageFitness: NaN });
  assert.equal(result.ok, false);
});

test("rejects alivePeak < 0", () => {
  const result = parseRunPayload({ ...baseRun(), alivePeak: -1 });
  assert.equal(result.ok, false);
});

test("rejects durationMs > 86400000", () => {
  const result = parseRunPayload({ ...baseRun(), durationMs: 86400001 });
  assert.equal(result.ok, false);
});

test("rejects unknown reason", () => {
  const result = parseRunPayload({ ...baseRun(), reason: "unknown-reason" });
  assert.equal(result.ok, false);
});

test("accepts all allowed reasons", () => {
  for (const reason of ALLOWED_REASONS) {
    const result = parseRunPayload({ ...baseRun(), reason });
    assert.equal(result.ok, true, "should accept reason: " + reason);
  }
});

test("rejects invalid endedAt date string", () => {
  const result = parseRunPayload({ ...baseRun(), endedAt: "not-a-date" });
  assert.equal(result.ok, false);
});

test("rejects missing config", () => {
  const { config: _config, ...rest } = baseRun();
  const result = parseRunPayload(rest);
  assert.equal(result.ok, false);
});

test("rejects config.population out of range", () => {
  const result = parseRunPayload({ ...baseRun(), config: { ...baseRun().config, population: 5 } });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("population")));
});

test("rejects config.mutationRate out of range", () => {
  const result = parseRunPayload({
    ...baseRun(),
    config: { ...baseRun().config, mutationRate: 0.99 },
  });
  assert.equal(result.ok, false);
});

test("rejects config.laneCount out of range", () => {
  const result = parseRunPayload({ ...baseRun(), config: { ...baseRun().config, laneCount: 1 } });
  assert.equal(result.ok, false);
});

test("accumulates multiple errors", () => {
  const result = parseRunPayload({ generation: 0, bestDistance: -1, config: {} });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 3);
});

test("assigns a generated id when none provided", () => {
  const { id: _id, ...run } = baseRun();
  const result = parseRunPayload(run);
  assert.equal(result.ok, true);
  assert.ok(typeof result.value.id === "string" && result.value.id.length > 0);
});

test("uses provided id when valid", () => {
  const result = parseRunPayload({ ...baseRun(), id: "custom-id-123" });
  assert.equal(result.ok, true);
  assert.equal(result.value.id, "custom-id-123");
});
