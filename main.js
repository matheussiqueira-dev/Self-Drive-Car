const carCanvas = document.getElementById("carCanvas");
const networkCanvas = document.getElementById("networkCanvas");

const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");

const CONFIG = {
    population: 100,
    trafficCount: 50,
    laneCount: 3,
    mutationRate: 0.1,
    carWidth: 30,
    carHeight: 50
};

const COLORS = {
    best: "#39c6f4",
    ghost: "#94b8d6",
    traffic: "#ff6b6b"
};

const BEST_BRAIN_KEY = "bestBrain";

const ui = {
    generation: document.getElementById("generation"),
    population: document.getElementById("population"),
    bestDistance: document.getElementById("bestDistance"),
    aliveCars: document.getElementById("aliveCars"),
    fps: document.getElementById("fps"),
    simSpeed: document.getElementById("simSpeed"),
    simStatus: document.getElementById("simStatus"),
    statusDot: document.getElementById("statusDot"),
    roadBadge: document.getElementById("roadBadge"),
    networkBadge: document.getElementById("networkBadge"),
    saveBrain: document.getElementById("saveBrain"),
    resetGeneration: document.getElementById("resetGeneration"),
    discardBrain: document.getElementById("discardBrain"),
    pauseResume: document.getElementById("pauseResume"),
    toggleSensors: document.getElementById("toggleSensors"),
    toggleGhosts: document.getElementById("toggleGhosts"),
    toggleNetwork: document.getElementById("toggleNetwork"),
    speedSelect: document.getElementById("speedSelect")
};

const sim = {
    speedSteps: 1,
    showSensors: true,
    showGhosts: true,
    showNetwork: true,
    paused: false
};

let carCanvasSize = { width: 0, height: 0 };
let networkCanvasSize = { width: 0, height: 0 };
let road = null;
let cars = [];
let traffic = [];
let bestCar = null;
let generation = 1;
let lastFrameTime = performance.now();
let smoothedFps = 60;
let lastFpsUpdate = 0;
let savedBrain = null;

init();

function init() {
    bindUI();
    resizeCanvases();

    cars = generateCars(CONFIG.population);
    bestCar = cars[0];

    savedBrain = loadSavedBrain();
    applySavedBrain();

    traffic = generateTraffic(CONFIG.trafficCount);

    updateText(ui.population, CONFIG.population);
    updateText(ui.generation, generation);
    updateSimSpeed(sim.speedSteps);
    updateStatusBadges();

    requestAnimationFrame(animate);
}

function bindUI() {
    if (ui.saveBrain) ui.saveBrain.addEventListener("click", save);
    if (ui.discardBrain) ui.discardBrain.addEventListener("click", discard);
    if (ui.resetGeneration) ui.resetGeneration.addEventListener("click", resetGeneration);
    if (ui.pauseResume) ui.pauseResume.addEventListener("click", togglePause);

    if (ui.toggleSensors) {
        ui.toggleSensors.addEventListener("change", (event) => {
            sim.showSensors = event.target.checked;
        });
    }

    if (ui.toggleGhosts) {
        ui.toggleGhosts.addEventListener("change", (event) => {
            sim.showGhosts = event.target.checked;
        });
    }

    if (ui.toggleNetwork) {
        ui.toggleNetwork.addEventListener("change", (event) => {
            sim.showNetwork = event.target.checked;
            updateStatusBadges();
        });
    }

    if (ui.speedSelect) {
        ui.speedSelect.addEventListener("change", (event) => {
            updateSimSpeed(Number(event.target.value));
        });
    }

    window.addEventListener("resize", resizeCanvases);
}

function updateSimSpeed(value) {
    sim.speedSteps = Number.isFinite(value) ? value : 1;
    updateText(ui.simSpeed, `${sim.speedSteps}x`);
}

function togglePause() {
    sim.paused = !sim.paused;
    if (ui.pauseResume) {
        ui.pauseResume.textContent = sim.paused ? "Retomar" : "Pausar";
    }
    updateStatusBadges();
}

function updateStatusBadges() {
    if (ui.statusDot) {
        ui.statusDot.dataset.state = sim.paused ? "paused" : "running";
    }
    if (ui.simStatus) {
        ui.simStatus.textContent = sim.paused ? "Simulacao pausada" : "Simulacao ativa";
    }
    if (ui.roadBadge) {
        ui.roadBadge.textContent = sim.paused ? "Paused" : "Live";
    }
    if (ui.networkBadge) {
        ui.networkBadge.textContent = sim.showNetwork ? (sim.paused ? "Paused" : "Live") : "Off";
    }
}

function updateText(element, value) {
    if (!element) return;
    const next = String(value);
    if (element.textContent !== next) {
        element.textContent = next;
    }
}

function resizeCanvas(canvas, ctx) {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { width, height };
}

function resizeCanvases() {
    const previousRoad = road;
    carCanvasSize = resizeCanvas(carCanvas, carCtx);
    networkCanvasSize = resizeCanvas(networkCanvas, networkCtx);
    road = new Road(carCanvasSize.width / 2, carCanvasSize.width * 0.9, CONFIG.laneCount);

    if (previousRoad) {
        realignCarsToLanes(previousRoad, road, cars);
        realignCarsToLanes(previousRoad, road, traffic);
    }
}

function realignCarsToLanes(previousRoad, nextRoad, list) {
    if (!list || list.length === 0) return;
    const laneWidth = previousRoad.width / previousRoad.laneCount;
    list.forEach((car) => {
        if (!car) return;
        const laneIndex = Math.min(
            previousRoad.laneCount - 1,
            Math.max(0, Math.round((car.x - previousRoad.left) / laneWidth))
        );
        car.x = nextRoad.getLaneCenter(laneIndex);
    });
}

function generateCars(count) {
    const generated = [];
    for (let i = 0; i < count; i++) {
        generated.push(
            new Car(road.getLaneCenter(1), 100, CONFIG.carWidth, CONFIG.carHeight, "AI")
        );
    }
    return generated;
}

function generateTraffic(count) {
    const generated = [];
    for (let i = 0; i < count; i++) {
        const y = -i * 600 - 100 - Math.random() * 400;
        const lane = Math.floor(Math.random() * CONFIG.laneCount);
        const speed = 1.5 + Math.random();

        generated.push(new Car(road.getLaneCenter(lane), y, 30, 50, "DUMMY", speed));

        if (Math.random() < 0.3) {
            const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % CONFIG.laneCount;
            generated.push(new Car(road.getLaneCenter(lane2), y, 30, 50, "DUMMY", speed));
        }
    }
    return generated;
}

function loadSavedBrain() {
    const stored = localStorage.getItem(BEST_BRAIN_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch (error) {
        return null;
    }
}

function cloneBrain(brain) {
    if (!brain) return null;
    if (typeof structuredClone === "function") {
        return structuredClone(brain);
    }
    return JSON.parse(JSON.stringify(brain));
}

function applySavedBrain() {
    if (!savedBrain) return;
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = cloneBrain(savedBrain);
        if (i !== 0) NeuralNetwork.mutate(cars[i].brain, CONFIG.mutationRate);
    }
}

function save() {
    if (!bestCar) return;
    localStorage.setItem(BEST_BRAIN_KEY, JSON.stringify(bestCar.brain));
    savedBrain = loadSavedBrain();
}

function discard() {
    localStorage.removeItem(BEST_BRAIN_KEY);
    savedBrain = null;
}

function resetGeneration() {
    generation += 1;
    updateText(ui.generation, generation);

    for (let i = 0; i < cars.length; i++) {
        cars[i] = new Car(road.getLaneCenter(1), 100, CONFIG.carWidth, CONFIG.carHeight, "AI");
        if (savedBrain) {
            cars[i].brain = cloneBrain(savedBrain);
            if (i !== 0) NeuralNetwork.mutate(cars[i].brain, CONFIG.mutationRate);
        }
    }
    bestCar = cars[0];
}

function stepSimulation() {
    traffic.forEach((trafficCar) => trafficCar.update(road, []));

    let bestFitness = -Infinity;
    let aliveCount = 0;
    let currentBest = bestCar || cars[0];

    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        car.update(road, traffic);
        if (!car.damaged) aliveCount += 1;
        if (car.fitness > bestFitness) {
            bestFitness = car.fitness;
            currentBest = car;
        }
    }

    bestCar = currentBest;
    return aliveCount;
}

function drawPausedOverlay() {
    carCtx.save();
    carCtx.fillStyle = "rgba(15, 23, 42, 0.6)";
    carCtx.fillRect(0, 0, carCanvasSize.width, carCanvasSize.height);
    carCtx.fillStyle = "#e2e8f0";
    carCtx.font = "600 20px 'Space Grotesk', 'Segoe UI', sans-serif";
    carCtx.textAlign = "center";
    carCtx.textBaseline = "middle";
    carCtx.fillText("Simulacao pausada", carCanvasSize.width / 2, carCanvasSize.height / 2);
    carCtx.restore();
}

function drawNetworkPlaceholder() {
    networkCtx.save();
    networkCtx.fillStyle = "rgba(12, 18, 30, 0.65)";
    networkCtx.fillRect(0, 0, networkCanvasSize.width, networkCanvasSize.height);
    networkCtx.fillStyle = "#93a1b1";
    networkCtx.font = "600 16px 'Space Grotesk', 'Segoe UI', sans-serif";
    networkCtx.textAlign = "center";
    networkCtx.textBaseline = "middle";
    networkCtx.fillText("Network hidden", networkCanvasSize.width / 2, networkCanvasSize.height / 2);
    networkCtx.restore();
}

function drawScene() {
    if (!bestCar || !road) return;

    carCtx.clearRect(0, 0, carCanvasSize.width, carCanvasSize.height);
    networkCtx.clearRect(0, 0, networkCanvasSize.width, networkCanvasSize.height);

    carCtx.save();
    carCtx.translate(0, -bestCar.y + carCanvasSize.height * 0.7);

    road.draw(carCtx);
    traffic.forEach((trafficCar) => trafficCar.draw(carCtx, COLORS.traffic));

    if (sim.showGhosts) {
        carCtx.globalAlpha = 0.18;
        cars.forEach((car) => {
            if (car !== bestCar) car.draw(carCtx, COLORS.ghost);
        });
        carCtx.globalAlpha = 1;
    }

    bestCar.draw(carCtx, COLORS.best, sim.showSensors);
    carCtx.restore();

    if (sim.paused) {
        drawPausedOverlay();
    }

    if (sim.showNetwork) {
        Visualizer.drawNetwork(networkCtx, bestCar.brain);
    } else {
        drawNetworkPlaceholder();
    }
}

function updateFps(timestamp) {
    const delta = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    const current = 1000 / Math.max(1, delta);
    smoothedFps = smoothedFps * 0.9 + current * 0.1;
    if (timestamp - lastFpsUpdate > 250) {
        updateText(ui.fps, Math.round(smoothedFps));
        lastFpsUpdate = timestamp;
    }
}

function animate(timestamp) {
    updateFps(timestamp);

    let aliveCount = cars.length;
    if (!sim.paused) {
        for (let step = 0; step < sim.speedSteps; step++) {
            aliveCount = stepSimulation();
        }
    } else {
        aliveCount = 0;
        for (let i = 0; i < cars.length; i++) {
            if (!cars[i].damaged) aliveCount += 1;
        }
    }

    drawScene();

    if (bestCar) {
        updateText(ui.bestDistance, Math.max(0, Math.round(-bestCar.y)));
    }
    updateText(ui.aliveCars, aliveCount);

    requestAnimationFrame(animate);
}
