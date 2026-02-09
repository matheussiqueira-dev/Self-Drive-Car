class Car {
    constructor(x, y, width, height, controlType, maxSpeed = 3) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.speed = 0;
        this.acceleration = 0.2;
        this.maxSpeed = maxSpeed;
        this.friction = 0.05;
        this.angle = 0;
        this.damaged = false;
        this.fitness = 0;

        this.useBrain = controlType === "AI";

        if (controlType !== "DUMMY") {
            this.sensor = new RaySensor(this);
            this.brain = new NeuralNetwork([this.sensor.rayCount, 6, 4]);
        }

        this.controls = new Controls(controlType);
        this.polygon = this.#createPolygon();
    }

    update(road, traffic) {
        if (!this.damaged) {
            this.#move();
            this.polygon = this.#createPolygon();
            this.damaged = this.#assessDamage(road.borders, traffic);
        }

        if (this.sensor) {
            this.sensor.update(road.borders, traffic);
            const offsets = this.sensor.readings.map((reading) => (reading == null ? 0 : 1 - reading.offset));
            const outputs = NeuralNetwork.feedForward(offsets, this.brain);

            if (this.useBrain) {
                this.controls.forward = outputs[0];
                this.controls.left = outputs[1];
                this.controls.right = outputs[2];
                this.controls.reverse = outputs[3];
            }
        }

        this.#updateFitness(road);
    }

    #updateFitness(road) {
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

        this.fitness = distance - minLaneDistance * 0.5;

        if (this.damaged) {
            this.fitness -= 1000;
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

    #createPolygon() {
        const points = [];
        const radius = Math.hypot(this.width, this.height) / 2;
        const alpha = Math.atan2(this.width, this.height);

        points.push({
            x: this.x - Math.sin(this.angle - alpha) * radius,
            y: this.y - Math.cos(this.angle - alpha) * radius
        });

        points.push({
            x: this.x - Math.sin(this.angle + alpha) * radius,
            y: this.y - Math.cos(this.angle + alpha) * radius
        });

        points.push({
            x: this.x - Math.sin(Math.PI + this.angle - alpha) * radius,
            y: this.y - Math.cos(Math.PI + this.angle - alpha) * radius
        });

        points.push({
            x: this.x - Math.sin(Math.PI + this.angle + alpha) * radius,
            y: this.y - Math.cos(Math.PI + this.angle + alpha) * radius
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
            if (this.controls.left) {
                this.angle += 0.03 * flip;
            }
            if (this.controls.right) {
                this.angle -= 0.03 * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
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
