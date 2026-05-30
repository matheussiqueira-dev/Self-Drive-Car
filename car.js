/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

class Car {
  constructor(x, y, width, height, controlType, maxSpeed = 3) {
    this.controlType = controlType;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.speed = 0;
    this.acceleration = controlType === "AI" ? 0.16 : 0.2;
    this.maxSpeed = maxSpeed;
    this.friction = controlType === "DUMMY" ? 0 : 0.06;
    this.steerStrength = controlType === "AI" ? 0.021 : 0.03;
    this.maxAngle = controlType === "AI" ? 0.48 : 0.72;
    this.steerAmount = 0;
    this.angle = 0;
    this.damaged = false;
    this.fitness = 0;
    this.framesAlive = 0;
    this.distanceTravelled = 0;
    this.passedTraffic = 0;
    this.riskStatus = "clear";
    this.frontGap = null;

    this.useBrain = controlType === "AI";

    if (controlType !== "DUMMY") {
      this.sensor = new RaySensor(this);
      this.brain = NeuralNetwork.createBaseline(this.sensor.rayCount);
    } else {
      this.speed = maxSpeed;
    }

    this.controls = new Controls(controlType);
    this.polygon = this.#createPolygon();
  }

  update(road, traffic) {
    const perceptionTraffic = this.sensor
      ? this.#nearbyTraffic(traffic, this.sensor.rayLength + this.height * 2)
      : traffic;

    if (!this.damaged) {
      this.#decide(road, perceptionTraffic);
      this.#move();
      this.polygon = this.#createPolygon();
      this.damaged = this.#assessDamage(
        road.borders,
        this.#nearbyTraffic(traffic, this.height * 2.5)
      );
      this.framesAlive++;
    }

    this.#updateFitness(road, traffic);
  }

  #decide(road, traffic) {
    if (this.sensor) {
      this.sensor.update(road.borders, traffic);
      const inputs = this.sensor.getNetworkInputs();
      if (!NeuralNetwork.isCompatible(this.brain, inputs.length, 4)) {
        this.brain = NeuralNetwork.createBaseline(inputs.length);
      }
      const outputs = NeuralNetwork.feedForward(inputs, this.brain);

      if (this.useBrain) {
        const safe = DrivingSafety.refine({
          car: this,
          road,
          traffic,
          neuralOutputs: outputs,
        });
        this.controls.forward = safe.forward;
        this.controls.left = safe.left;
        this.controls.right = safe.right;
        this.controls.reverse = safe.reverse;
        this.riskStatus = safe.risk;
        this.frontGap = safe.frontGap;
      }
    }
  }

  #updateFitness(road, traffic) {
    const distance = -this.y;
    let minLaneDistance = 0;

    if (road?.laneCount) {
      minLaneDistance = Infinity;
      for (let i = 0; i < road.laneCount; i++) {
        const laneCenter = road.getLaneCenter(i);
        const distanceToLane = Math.abs(this.x - laneCenter);
        if (distanceToLane < minLaneDistance) {
          minLaneDistance = distanceToLane;
        }
      }
    }

    this.distanceTravelled = Math.max(this.distanceTravelled, Math.max(0, distance));
    this.passedTraffic = traffic.filter((trafficCar) => trafficCar.y > this.y + 70).length;

    const lanePenalty = minLaneDistance * 1.1;
    const smoothnessPenalty = Math.abs(this.angle) * 110 + Math.abs(this.steerAmount) * 16;
    const reversePenalty = this.speed < -0.05 ? 220 : 0;
    const stoppedPenalty = this.framesAlive > 90 && this.speed < 0.2 ? 180 : 0;
    const proximityPenalty =
      this.frontGap !== null && this.frontGap < 130 ? Math.max(0, 130 - this.frontGap) * 4 : 0;

    this.fitness =
      this.distanceTravelled +
      this.framesAlive * 0.42 +
      this.passedTraffic * 120 -
      lanePenalty -
      smoothnessPenalty -
      reversePenalty -
      stoppedPenalty -
      proximityPenalty;

    if (this.damaged) {
      const earlyCrashPenalty = Math.max(0, 600 - this.distanceTravelled) * 4;
      this.fitness -= 5000 + earlyCrashPenalty;
    }
  }

  #assessDamage(roadBorders, traffic) {
    for (let i = 0; i < roadBorders.length; i++) {
      if (polysIntersect(this.polygon, roadBorders[i])) {
        return true;
      }
    }

    for (let i = 0; i < traffic.length; i++) {
      if (polysIntersect(this.polygon, traffic[i].polygon)) {
        return true;
      }
    }

    return false;
  }

  #nearbyTraffic(traffic, range) {
    if (!Array.isArray(traffic) || traffic.length === 0) return [];
    return traffic.filter((trafficCar) => Math.abs(trafficCar.y - this.y) <= range);
  }

  #createPolygon() {
    const points = [];
    const radius = Math.hypot(this.width, this.height) / 2;
    const alpha = Math.atan2(this.width, this.height);

    points.push({
      x: this.x - Math.sin(this.angle - alpha) * radius,
      y: this.y - Math.cos(this.angle - alpha) * radius,
    });

    points.push({
      x: this.x - Math.sin(this.angle + alpha) * radius,
      y: this.y - Math.cos(this.angle + alpha) * radius,
    });

    points.push({
      x: this.x - Math.sin(Math.PI + this.angle - alpha) * radius,
      y: this.y - Math.cos(Math.PI + this.angle - alpha) * radius,
    });

    points.push({
      x: this.x - Math.sin(Math.PI + this.angle + alpha) * radius,
      y: this.y - Math.cos(Math.PI + this.angle + alpha) * radius,
    });

    return points;
  }

  #move() {
    if (this.controls.forward) {
      this.speed += this.acceleration;
    }

    if (this.controls.reverse) {
      this.speed -= this.acceleration;
    }

    if (this.speed > this.maxSpeed) {
      this.speed = this.maxSpeed;
    }

    if (this.speed < -this.maxSpeed / 2) {
      this.speed = -this.maxSpeed / 2;
    }

    if (this.speed > 0) {
      this.speed -= this.friction;
    }

    if (this.speed < 0) {
      this.speed += this.friction;
    }

    if (Math.abs(this.speed) < this.friction) {
      this.speed = 0;
    }

    if (this.speed !== 0) {
      const flip = this.speed > 0 ? 1 : -1;
      const steerTarget = this.controls.left ? 1 : this.controls.right ? -1 : 0;
      const smoothing = this.controlType === "AI" ? 0.24 : 0.5;
      this.steerAmount = lerp(this.steerAmount, steerTarget, smoothing);
      const speedFactor =
        0.55 + Math.min(1, Math.abs(this.speed) / Math.max(1, this.maxSpeed)) * 0.45;
      this.angle += this.steerAmount * this.steerStrength * speedFactor * flip;
    } else {
      this.steerAmount = lerp(this.steerAmount, 0, 0.25);
    }

    if (!this.controls.left && !this.controls.right && this.controlType === "AI") {
      this.angle = lerp(this.angle, 0, 0.035);
    }

    this.angle = Math.min(this.maxAngle, Math.max(-this.maxAngle, this.angle));
    this.x -= Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;
  }

  getMetrics() {
    return {
      framesAlive: this.framesAlive,
      fitness: this.fitness,
      distance: this.distanceTravelled,
      passedTraffic: this.passedTraffic,
      riskStatus: this.riskStatus,
      frontGap: this.frontGap,
    };
  }

  draw(ctx, color, drawSensor = false) {
    if (this.sensor && drawSensor) {
      this.sensor.draw(ctx);
    }

    if (this.damaged) {
      this.#drawDamaged(ctx);
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(-this.angle);
    this.#drawBody(ctx, color);
    ctx.restore();
  }

  #drawBody(ctx, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 5);
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(-this.width / 2 + 5, -this.height / 2 + 10, this.width - 10, this.height - 20);

    ctx.fillStyle = "rgba(100, 200, 255, 0.6)";
    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 5, -this.height / 2 + 10);
    ctx.lineTo(this.width / 2 - 5, -this.height / 2 + 10);
    ctx.lineTo(this.width / 2 - 7, -this.height / 2 + 18);
    ctx.lineTo(-this.width / 2 + 7, -this.height / 2 + 18);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-this.width / 2 + 5, this.height / 2 - 10);
    ctx.lineTo(this.width / 2 - 5, this.height / 2 - 10);
    ctx.lineTo(this.width / 2 - 7, this.height / 2 - 18);
    ctx.lineTo(-this.width / 2 + 7, this.height / 2 - 18);
    ctx.fill();

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.arc(-this.width / 2 + 8, -this.height / 2 + 2, 3, 0, Math.PI * 2);
    ctx.arc(this.width / 2 - 8, -this.height / 2 + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "red";
    ctx.fillRect(-this.width / 2 + 5, this.height / 2 - 3, 8, 3);
    ctx.fillRect(this.width / 2 - 13, this.height / 2 - 3, 8, 3);

    ctx.fillStyle = "black";
    ctx.fillRect(-this.width / 2 - 2, -this.height / 2 + 8, 4, 10);
    ctx.fillRect(this.width / 2 - 2, -this.height / 2 + 8, 4, 10);
    ctx.fillRect(-this.width / 2 - 2, this.height / 2 - 18, 4, 10);
    ctx.fillRect(this.width / 2 - 2, this.height / 2 - 18, 4, 10);
  }

  #drawDamaged(ctx) {
    if (!this.polygon || this.polygon.length === 0) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "#8f96a3";
    ctx.beginPath();
    ctx.moveTo(this.polygon[0].x, this.polygon[0].y);

    for (let i = 1; i < this.polygon.length; i++) {
      ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
