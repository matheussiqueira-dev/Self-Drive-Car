/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

class SimulationEngine {
  constructor(config) {
    this.config = { ...config };
    this.road = null;
    this.cars = [];
    this.traffic = [];
    this.bestCar = null;
    this.generation = 1;
    this.bestDistance = 0;
    this.averageFitness = 0;
    this.aliveCars = this.config.population;
    this.peakAlive = this.config.population;
    this.extinctionTimestamp = null;
    this.generationStartedAt = performance.now();
  }

  setRoad(road) {
    const prev = this.road;
    this.road = road;
    if (!prev || !road) return;
    this.#realign(prev, road, this.cars);
    this.#realign(prev, road, this.traffic);
  }

  initialize(savedBrain) {
    this.cars = this.#generateCars(this.config.population);
    this.bestCar = this.cars[0] || null;
    this.#applyBrain(savedBrain);
    this.traffic = this.#generateTraffic(this.config.trafficCount);
    this.bestDistance = 0;
    this.averageFitness = 0;
    this.aliveCars = this.config.population;
    this.peakAlive = this.config.population;
    this.extinctionTimestamp = null;
    this.generationStartedAt = performance.now();
  }

  applyConfig(next) {
    this.config = { ...this.config, ...next };
  }

  step(timestamp) {
    this.traffic.forEach((t) => t.update(this.road, []));
    let bestFit = -Infinity,
      avg = 0,
      alive = 0,
      leader = this.bestCar || this.cars[0];

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      car.update(this.road, this.traffic);
      if (!car.damaged) alive++;
      avg += car.fitness;
      if (car.fitness > bestFit) {
        bestFit = car.fitness;
        leader = car;
      }
    }

    this.bestCar = leader || this.bestCar;
    this.aliveCars = alive;
    this.peakAlive = Math.max(this.peakAlive, alive);
    this.averageFitness = this.cars.length ? avg / this.cars.length : 0;
    if (this.bestCar)
      this.bestDistance = Math.max(this.bestDistance, Math.max(0, Math.round(-this.bestCar.y)));

    let shouldReset = false;
    if (this.config.autoResetOnExtinction) {
      if (alive === 0) {
        if (this.extinctionTimestamp === null) this.extinctionTimestamp = timestamp;
        else if (timestamp - this.extinctionTimestamp >= this.config.extinctionDelayMs) {
          shouldReset = true;
          this.extinctionTimestamp = null;
        }
      } else this.extinctionTimestamp = null;
    }

    return { aliveCount: alive, shouldReset };
  }

  countAliveCars() {
    let alive = 0;
    for (let i = 0; i < this.cars.length; i++) if (!this.cars[i].damaged) alive++;
    this.aliveCars = alive;
    return alive;
  }

  resetGeneration({ savedBrain, reason, timestamp, keepTraffic }) {
    const report = this.createGenerationReport(reason, timestamp);
    this.generation++;
    this.cars = this.#generateCars(this.config.population);
    this.bestCar = this.cars[0] || null;
    if (savedBrain) this.#applyBrain(savedBrain);
    if (keepTraffic) this.#repositionTraffic();
    else if (this.config.resetTrafficOnGeneration)
      this.traffic = this.#generateTraffic(this.config.trafficCount);

    this.bestDistance = 0;
    this.averageFitness = 0;
    this.aliveCars = this.cars.length;
    this.peakAlive = this.cars.length;
    this.extinctionTimestamp = null;
    this.generationStartedAt = timestamp;
    return report;
  }

  createGenerationReport(reason, timestamp) {
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      generation: this.generation,
      bestDistance: this.bestDistance,
      averageFitness: Number(this.averageFitness.toFixed(2)),
      alivePeak: this.peakAlive,
      durationMs: Math.max(0, Math.round(timestamp - this.generationStartedAt)),
      reason,
      endedAt: new Date().toISOString(),
      config: {
        population: this.config.population,
        trafficCount: this.config.trafficCount,
        mutationRate: this.config.mutationRate,
        laneCount: this.config.laneCount,
      },
    };
  }

  #generateCars(count) {
    const cars = [];
    const laneIndex = Math.floor(this.config.laneCount / 2);
    for (let i = 0; i < count; i++)
      cars.push(
        new Car(
          this.road.getLaneCenter(laneIndex),
          100,
          this.config.carWidth,
          this.config.carHeight,
          "AI"
        )
      );
    return cars;
  }

  #generateTraffic(count) {
    const generated = [];
    const laneOffsets = new Array(this.config.laneCount).fill(-this.config.startSafeDistance);
    const speedRange = Math.max(0.1, this.config.trafficSpeedMax - this.config.trafficSpeedMin);
    const spawn = (lane, y) =>
      generated.push(
        new Car(
          this.road.getLaneCenter(lane),
          y,
          30,
          50,
          "DUMMY",
          this.config.trafficSpeedMin + Math.random() * speedRange
        )
      );

    for (let i = 0; i < count; i++) {
      const lane = Math.floor(Math.random() * this.config.laneCount);
      const gap = this.config.trafficMinGap + Math.random() * this.config.trafficGapJitter;
      laneOffsets[lane] -= gap;
      const y = laneOffsets[lane];
      spawn(lane, y);
      if (Math.random() < 0.24) {
        const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % this.config.laneCount;
        const pairGap =
          this.config.trafficMinGap * 0.7 + Math.random() * (this.config.trafficGapJitter * 0.5);
        laneOffsets[lane2] = Math.min(laneOffsets[lane2], y - pairGap);
        spawn(lane2, y);
      }
    }

    return generated;
  }

  #applyBrain(brain) {
    if (!brain) return;
    for (let i = 0; i < this.cars.length; i++) {
      this.cars[i].brain = cloneBrain(brain);
      if (i !== 0) NeuralNetwork.mutate(this.cars[i].brain, this.config.mutationRate);
    }
  }

  #realign(prev, next, list) {
    if (!Array.isArray(list) || list.length === 0) return;
    const laneWidth = prev.width / prev.laneCount;
    list.forEach((car) => {
      const laneIndex = Math.min(
        prev.laneCount - 1,
        Math.max(0, Math.round((car.x - prev.left) / laneWidth))
      );
      car.x = next.getLaneCenter(laneIndex);
    });
  }

  #repositionTraffic() {
    if (!this.bestCar) return;
    const shift = this.bestCar.y - 100;
    this.traffic.forEach((trafficCar) => {
      trafficCar.y += shift;
    });
  }
}
