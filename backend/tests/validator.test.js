const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRunPayload } = require("../src/validator");

function baseRun() {
    return {
        generation: 4,
        bestDistance: 934,
        averageFitness: 120.42,
        alivePeak: 100,
        durationMs: 42000,
        reason: "manual",
        endedAt: new Date().toISOString(),
        config: {
            population: 100,
            trafficCount: 50,
            mutationRate: 0.1,
            laneCount: 3
        }
    };
}

test("validator accepts valid payload", () => {
    const result = parseRunPayload(baseRun());
    assert.equal(result.ok, true);
    assert.equal(result.value.generation, 4);
    assert.equal(result.value.config.population, 100);
});

test("validator rejects invalid payload", () => {
    const result = parseRunPayload({
        generation: 0,
        bestDistance: -1,
        config: {}
    });

    assert.equal(result.ok, false);
    assert.ok(result.errors.length >= 3);
});
