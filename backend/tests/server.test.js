const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createServer } = require("../src/server");

function runPayload() {
    return {
        generation: 2,
        bestDistance: 512,
        averageFitness: 71.2,
        alivePeak: 80,
        durationMs: 21000,
        reason: "extinction",
        endedAt: new Date().toISOString(),
        config: {
            population: 100,
            trafficCount: 50,
            mutationRate: 0.1,
            laneCount: 3
        }
    };
}

test("server creates and fetches runs", async () => {
    const tempFile = path.join(os.tmpdir(), `neural-drive-test-${Date.now()}.json`);
    const apiKey = "test-key";

    const app = createServer({
        host: "127.0.0.1",
        port: 0,
        dataFile: tempFile,
        apiKey,
        rateLimitMax: 100
    });

    const { port } = await app.start();
    const baseUrl = `http://127.0.0.1:${port}`;

    const createRes = await fetch(`${baseUrl}/api/v1/runs`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey
        },
        body: JSON.stringify(runPayload())
    });

    assert.equal(createRes.status, 201);

    const listRes = await fetch(`${baseUrl}/api/v1/runs?limit=5`, {
        headers: {
            "x-api-key": apiKey
        }
    });

    assert.equal(listRes.status, 200);
    const body = await listRes.json();
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data.length, 1);

    await app.stop();
    await fs.rm(tempFile, { force: true });
});
