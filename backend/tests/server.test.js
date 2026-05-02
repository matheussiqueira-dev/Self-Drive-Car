/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createServer } = require("../src/server");

function runPayload(overrides = {}) {
  return {
    generation: 2,
    bestDistance: 512,
    averageFitness: 71.2,
    alivePeak: 80,
    durationMs: 21000,
    reason: "extinction",
    endedAt: new Date().toISOString(),
    config: { population: 100, trafficCount: 50, mutationRate: 0.1, laneCount: 3 },
    ...overrides,
  };
}

async function startApp() {
  const tempFile = path.join(os.tmpdir(), "neural-drive-test-" + Date.now() + ".json");
  const apiKey = "test-api-key";
  const adminKey = "test-admin-key";

  const app = createServer({
    host: "127.0.0.1",
    port: 0,
    dataFile: tempFile,
    apiKey,
    adminKey,
    rateLimitMax: 200,
  });

  const { port } = await app.start();
  const base = "http://127.0.0.1:" + port;
  return { app, base, apiKey, adminKey, tempFile };
}

async function stopApp(app, tempFile) {
  await app.stop();
  await fs.rm(tempFile, { force: true });
}

test("GET /api/v1/health returns ok", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.ok(typeof body.uptimeSeconds === "number");
    assert.ok(typeof body.timestamp === "string");
    assert.ok(res.headers.get("x-request-id"), "should include X-Request-Id");
  } finally {
    await stopApp(app, tempFile);
  }
});

test("GET unknown route returns 404", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/not-a-route");
    assert.equal(res.status, 404);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("GET /api/v1/runs without key returns 401", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/runs");
    assert.equal(res.status, 401);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("POST /api/v1/runs without key returns 401", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runPayload()),
    });
    assert.equal(res.status, 401);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("POST /api/v1/runs with invalid payload returns 422", async () => {
  const { app, base, apiKey, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ generation: 0 }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.ok(Array.isArray(body.details) && body.details.length > 0);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("POST then GET then DELETE full CRUD flow", async () => {
  const { app, base, apiKey, adminKey, tempFile } = await startApp();
  try {
    // Create
    const createRes = await fetch(base + "/api/v1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(runPayload()),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const id = created.data.id;
    assert.ok(typeof id === "string" && id.length > 0);

    // List
    const listRes = await fetch(base + "/api/v1/runs?limit=5", {
      headers: { "x-api-key": apiKey },
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.data.length, 1);
    assert.equal(list.meta.limit, 5);

    // Delete without admin key returns 401
    const delUnauth = await fetch(base + "/api/v1/runs/" + id, {
      method: "DELETE",
      headers: { "x-api-key": apiKey },
    });
    assert.equal(delUnauth.status, 401);

    // Delete with admin key succeeds
    const delRes = await fetch(base + "/api/v1/runs/" + id, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.deleted, 1);

    // Delete again returns 404
    const delAgain = await fetch(base + "/api/v1/runs/" + id, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    assert.equal(delAgain.status, 404);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("POST /api/v1/runs with invalid JSON returns 400", async () => {
  const { app, base, apiKey, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: "not-json{{{",
    });
    assert.equal(res.status, 400);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("OPTIONS preflight returns 204", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/runs", { method: "OPTIONS" });
    assert.equal(res.status, 204);
  } finally {
    await stopApp(app, tempFile);
  }
});

test("Response includes security headers", async () => {
  const { app, base, tempFile } = await startApp();
  try {
    const res = await fetch(base + "/api/v1/health");
    assert.ok(res.headers.get("x-content-type-options"), "missing X-Content-Type-Options");
    assert.ok(res.headers.get("x-frame-options"), "missing X-Frame-Options");
  } finally {
    await stopApp(app, tempFile);
  }
});
