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
    this.bestFitness = 0;
    this.collisionCount = 0;
    this.averageAliveFrames = 0;
    this.aliveCars = this.config.population;
    this.peakAlive = this.config.population;
    this.eliteBrain = null;
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
    this.bestFitness = 0;
    this.collisionCount = 0;
    this.averageAliveFrames = 0;
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
    let bestAliveFit = -Infinity,
      bestFallbackFit = -Infinity,
      avg = 0,
      aliveFrames = 0,
      alive = 0,
      aliveLeader = null,
      fallbackLeader = this.bestCar || this.cars[0];

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      car.update(this.road, this.traffic);

      avg += car.fitness;
      aliveFrames += car.framesAlive;

      if (car.fitness > bestFallbackFit) {
        bestFallbackFit = car.fitness;
        fallbackLeader = car;
      }

      if (!car.damaged) {
        alive++;
        if (car.fitness > bestAliveFit) {
          bestAliveFit = car.fitness;
          aliveLeader = car;
        }
      }
    }

    this.bestCar = aliveLeader || fallbackLeader || this.bestCar;
    this.aliveCars = alive;
    this.collisionCount = this.cars.length - alive;
    this.peakAlive = Math.max(this.peakAlive, alive);
    this.averageFitness = this.cars.length ? avg / this.cars.length : 0;
    this.averageAliveFrames = this.cars.length ? aliveFrames / this.cars.length : 0;
    this.bestFitness = Math.max(bestAliveFit, bestFallbackFit, this.bestFitness);
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
    const eliteBrain = this.#selectEliteBrain(savedBrain, report);
    this.generation++;
    this.cars = this.#generateCars(this.config.population);
    this.bestCar = this.cars[0] || null;
    this.#applyBrain(eliteBrain);
    if (keepTraffic) this.#repositionTraffic();
    else if (this.config.resetTrafficOnGeneration)
      this.traffic = this.#generateTraffic(this.config.trafficCount);

    this.bestDistance = 0;
    this.averageFitness = 0;
    this.bestFitness = 0;
    this.collisionCount = 0;
    this.averageAliveFrames = 0;
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
      bestFitness: Number(this.bestFitness.toFixed(2)),
      alivePeak: this.peakAlive,
      collisions: this.collisionCount,
      averageAliveFrames: Number(this.averageAliveFrames.toFixed(1)),
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

    const lanes = Array.from({ length: this.config.laneCount }, (_, index) => index);
    const difficulty = clamp(
      0.35 + this.generation * 0.025 + this.config.trafficCount / 360,
      0.35,
      0.9,
      0.5
    );
    let remaining = count;
    let row = 0;
    let y = -this.config.startSafeDistance - 180;

    while (remaining > 0) {
      const openLane = row % this.config.laneCount;
      const maxBlockers = Math.max(1, this.config.laneCount - 1);
      const blockers = Math.min(
        remaining,
        maxBlockers,
        Math.max(1, Math.round(difficulty * maxBlockers))
      );
      const candidates = this.#shuffle(lanes.filter((lane) => lane !== openLane));

      for (let i = 0; i < blockers; i++) {
        spawn(candidates[i], y + Math.random() * 22);
        remaining--;
        if (remaining === 0) break;
      }

      const rowGap =
        this.config.trafficMinGap +
        Math.random() * this.config.trafficGapJitter +
        (1 - difficulty) * 90;
      y -= rowGap;
      row++;
    }

    return generated;
  }

  #applyBrain(brain) {
    const inputCount = this.cars[0]?.sensor?.rayCount || 9;
    const source = NeuralNetwork.isCompatible(brain, inputCount)
      ? this.#cloneBrain(brain)
      : NeuralNetwork.createBaseline(inputCount);
    for (let i = 0; i < this.cars.length; i++) {
      this.cars[i].brain = this.#cloneBrain(source);
      if (i !== 0)
        NeuralNetwork.mutate(this.cars[i].brain, Math.min(this.config.mutationRate, 0.18));
    }
  }

  #selectEliteBrain(savedBrain, report) {
    if (NeuralNetwork.isCompatible(savedBrain, this.cars[0]?.sensor?.rayCount || 9)) {
      this.eliteBrain = this.#cloneBrain(savedBrain);
      return this.eliteBrain;
    }

    const hasProgress = report.bestDistance >= 280 && report.durationMs >= 2500;
    const hasUsefulFitness = this.bestCar && this.bestCar.fitness > 0;
    if (hasProgress && hasUsefulFitness && this.bestCar?.brain) {
      this.eliteBrain = this.#cloneBrain(this.bestCar.brain);
    }

    return this.eliteBrain;
  }

  #cloneBrain(brain) {
    return typeof cloneBrain === "function" ? cloneBrain(brain) : NeuralNetwork.clone(brain);
  }

  #shuffle(values) {
    const copy = values.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  #realign(prev, next, list) {
    if (!Array.isArray(list) || list.length === 0) return;
    const laneWidth = prev.width / prev.laneCount;
    list.forEach((car) => {
      const laneIndex = Math.min(
        prev.laneCount - 1,
        Math.max(0, Math.floor((car.x - prev.left) / laneWidth))
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
