/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const sources = [
  "utils.js",
  "network.js",
  "sensor.js",
  "road.js",
  "controls.js",
  "drivingSafety.js",
  "car.js",
  "appConfig.js",
  "simulationEngine.js",
];

function loadSimulator() {
  const context = vm.createContext({
    console,
    performance,
    structuredClone,
    window: { addEventListener() {} },
  });

  for (const source of sources) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, source), "utf8"), context, {
      filename: source,
    });
  }

  return vm.runInContext(
    `({
      polysIntersect,
      NeuralNetwork,
      Road,
      Car,
      DrivingSafety,
      SimulationEngine,
      DEFAULT_CONFIG
    })`,
    context
  );
}

test("polysIntersect detects overlapping and separated polygons", () => {
  const { polysIntersect } = loadSimulator();
  const a = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
    { x: 0, y: 30 },
  ];
  const b = [
    { x: 20, y: 20 },
    { x: 50, y: 20 },
    { x: 50, y: 50 },
    { x: 20, y: 50 },
  ];
  const c = [
    { x: 80, y: 80 },
    { x: 110, y: 80 },
    { x: 110, y: 110 },
    { x: 80, y: 110 },
  ];

  assert.equal(polysIntersect(a, b), true);
  assert.equal(polysIntersect(a, c), false);
});

test("car update marks collision with overlapping traffic", () => {
  const { Road, Car } = loadSimulator();
  const road = new Road(200, 300, 3);
  const x = road.getLaneCenter(1);
  const car = new Car(x, 100, 30, 50, "AI");
  const obstacle = new Car(x, 100, 30, 50, "DUMMY", 1.5);

  car.update(road, [obstacle]);

  assert.equal(car.damaged, true);
  assert.ok(car.fitness < -1000);
});

test("sensor detects vehicle ahead and road borders", () => {
  const { Road, Car } = loadSimulator();
  const road = new Road(200, 300, 3);
  const laneX = road.getLaneCenter(1);
  const car = new Car(laneX, 100, 30, 50, "AI");
  const obstacle = new Car(laneX, -60, 30, 50, "DUMMY", 1.5);

  car.sensor.update(road.borders, [obstacle]);
  assert.ok(car.sensor.getNetworkInputs()[4] > 0, "front ray should detect vehicle ahead");

  const edgeCar = new Car(road.left + 12, 100, 30, 50, "AI");
  edgeCar.sensor.update(road.borders, []);
  assert.ok(edgeCar.sensor.readings.some(Boolean), "sensor should detect a nearby border");
});

test("traffic generation keeps safe initial distance and avoids overlap", () => {
  const { Road, SimulationEngine, DEFAULT_CONFIG, polysIntersect } = loadSimulator();
  const engine = new SimulationEngine({ ...DEFAULT_CONFIG, trafficCount: 45, laneCount: 3 });
  engine.setRoad(new Road(220, 360, 3));
  engine.initialize(null);

  const minGap = Math.min(...engine.traffic.map((trafficCar) => 100 - trafficCar.y));
  assert.ok(
    minGap >= DEFAULT_CONFIG.startSafeDistance,
    "first traffic row should not spawn too close"
  );

  for (let i = 0; i < engine.traffic.length; i++) {
    for (let j = i + 1; j < engine.traffic.length; j++) {
      assert.equal(polysIntersect(engine.traffic[i].polygon, engine.traffic[j].polygon), false);
    }
  }
});

test("network clone is deep and mutation does not corrupt original", () => {
  const { NeuralNetwork } = loadSimulator();
  const brain = NeuralNetwork.createBaseline(9);
  const clone = NeuralNetwork.clone(brain);
  NeuralNetwork.mutate(clone, 1);

  assert.notStrictEqual(clone, brain);
  assert.notStrictEqual(clone.levels[0], brain.levels[0]);
  assert.notDeepStrictEqual(clone, brain);
  assert.deepStrictEqual(brain, NeuralNetwork.createBaseline(9));
});

test("safety layer prevents incoherent steering and reverse in AI mode", () => {
  const { Road, Car, DrivingSafety } = loadSimulator();
  const road = new Road(200, 300, 3);
  const car = new Car(road.getLaneCenter(1), 100, 30, 50, "AI");
  const safe = DrivingSafety.refine({
    car,
    road,
    traffic: [],
    neuralOutputs: [1, 1, 1, 1],
  });

  assert.equal(safe.left && safe.right, false);
  assert.equal(safe.reverse, false);
});

test("best brain is preserved intact for the next generation when progress is real", () => {
  const { Road, SimulationEngine, DEFAULT_CONFIG } = loadSimulator();
  const engine = new SimulationEngine({ ...DEFAULT_CONFIG, population: 20, trafficCount: 15 });
  engine.setRoad(new Road(220, 360, 3));
  engine.initialize(null);

  const elite = structuredClone(engine.bestCar.brain);
  engine.bestDistance = 620;
  engine.bestCar.fitness = 1200;
  engine.generationStartedAt = 0;

  engine.resetGeneration({
    savedBrain: null,
    reason: "manual",
    timestamp: 5000,
    keepTraffic: false,
  });

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(engine.cars[0].brain)),
    JSON.parse(JSON.stringify(elite))
  );
  assert.notStrictEqual(engine.cars[0].brain, elite);
});
