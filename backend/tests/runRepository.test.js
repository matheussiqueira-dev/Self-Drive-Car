/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { RunRepository } = require("../src/runRepository");

function makeRun(id, endedAt) {
  return {
    id: id || "run-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6),
    generation: 1,
    bestDistance: 100,
    averageFitness: 50,
    alivePeak: 10,
    durationMs: 5000,
    reason: "manual",
    endedAt: endedAt || new Date().toISOString(),
    config: { population: 100, trafficCount: 50, mutationRate: 0.1, laneCount: 3 },
  };
}

async function makeRepo(maxRuns) {
  const filePath = path.join(os.tmpdir(), "repo-test-" + Date.now() + ".json");
  const repo = new RunRepository({ filePath, maxRuns: maxRuns || 100 });
  await repo.init();
  return { repo, filePath };
}

async function cleanup(filePath) {
  await fs.rm(filePath, { force: true });
}

test("init creates file if missing", async () => {
  const { filePath } = await makeRepo();
  try {
    const content = JSON.parse(await fs.readFile(filePath, "utf8"));
    assert.ok(Array.isArray(content));
    assert.equal(content.length, 0);
  } finally {
    await cleanup(filePath);
  }
});

test("create stores a run and returns it", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    const run = makeRun();
    const created = await repo.create(run);
    assert.equal(created.id, run.id);
    const list = await repo.list(10);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, run.id);
  } finally {
    await cleanup(filePath);
  }
});

test("list sorts by endedAt descending", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    const old = makeRun("old", new Date(Date.now() - 5000).toISOString());
    const recent = makeRun("recent", new Date().toISOString());
    await repo.create(old);
    await repo.create(recent);
    const list = await repo.list(10);
    assert.equal(list[0].id, "recent");
    assert.equal(list[1].id, "old");
  } finally {
    await cleanup(filePath);
  }
});

test("list respects limit", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    for (let i = 0; i < 10; i++) {
      await repo.create(makeRun());
    }
    const list = await repo.list(3);
    assert.equal(list.length, 3);
  } finally {
    await cleanup(filePath);
  }
});

test("remove deletes the run by id", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    const run = makeRun("to-delete");
    await repo.create(run);
    const removed = await repo.remove("to-delete");
    assert.equal(removed, 1);
    const list = await repo.list(10);
    assert.equal(list.length, 0);
  } finally {
    await cleanup(filePath);
  }
});

test("remove returns 0 when id not found", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    const removed = await repo.remove("ghost-id");
    assert.equal(removed, 0);
  } finally {
    await cleanup(filePath);
  }
});

test("enforces maxRuns cap", async () => {
  const { repo, filePath } = await makeRepo(3);
  try {
    for (let i = 0; i < 5; i++) {
      await repo.create(makeRun());
    }
    const list = await repo.list(100);
    assert.equal(list.length, 3);
  } finally {
    await cleanup(filePath);
  }
});

test("concurrent writes do not corrupt file", async () => {
  const { repo, filePath } = await makeRepo();
  try {
    await Promise.all([repo.create(makeRun()), repo.create(makeRun()), repo.create(makeRun())]);
    const list = await repo.list(10);
    assert.equal(list.length, 3);
  } finally {
    await cleanup(filePath);
  }
});
