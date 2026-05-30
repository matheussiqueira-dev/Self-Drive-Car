/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

class RaySensor {
  constructor(car) {
    this.car = car;
    this.rayAngles = [-70, -42, -24, -12, 0, 12, 24, 42, 70].map(
      (degrees) => (degrees * Math.PI) / 180
    );
    this.rayCount = this.rayAngles.length;
    this.rayLength = 260;

    this.rays = [];
    this.readings = [];
    this.inputs = new Array(this.rayCount).fill(0);
  }

  update(roadBorders, traffic) {
    this.#castRays();
    this.readings = [];
    for (let i = 0; i < this.rays.length; i++) {
      this.readings.push(this.#getReading(this.rays[i], roadBorders, traffic));
    }
    this.inputs = this.readings.map((reading) =>
      reading == null ? 0 : Number((1 - reading.offset).toFixed(4))
    );
  }

  getNetworkInputs() {
    return this.inputs.slice();
  }

  #getReading(ray, roadBorders, traffic) {
    let touches = [];

    for (let i = 0; i < roadBorders.length; i++) {
      const touch = getIntersection(ray[0], ray[1], roadBorders[i][0], roadBorders[i][1]);
      if (touch) touches.push(touch);
    }

    for (let i = 0; i < traffic.length; i++) {
      const poly = traffic[i].polygon;
      for (let j = 0; j < poly.length; j++) {
        const value = getIntersection(ray[0], ray[1], poly[j], poly[(j + 1) % poly.length]);
        if (value) touches.push(value);
      }
    }

    if (touches.length === 0) return null;
    else {
      const offsets = touches.map((touch) => touch.offset);
      const minOffset = Math.min(...offsets);
      return touches.find((touch) => touch.offset === minOffset);
    }
  }

  #castRays() {
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) {
      const rayAngle = this.rayAngles[i] + this.car.angle;
      const start = { x: this.car.x, y: this.car.y };
      const end = {
        x: this.car.x - Math.sin(rayAngle) * this.rayLength,
        y: this.car.y - Math.cos(rayAngle) * this.rayLength,
      };
      this.rays.push([start, end]);
    }
  }

  draw(ctx) {
    if (this.rays.length === 0) return;

    for (let i = 0; i < this.rayCount; i++) {
      const start = this.rays[i][0];
      const rayEnd = this.rays[i][1];
      let end = this.rays[i][1];
      if (this.readings[i]) end = this.readings[i];

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "yellow";
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "black";
      ctx.moveTo(rayEnd.x, rayEnd.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  }
}
