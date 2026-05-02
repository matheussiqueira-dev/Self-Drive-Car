/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const carCanvas = document.getElementById("carCanvas");
const networkCanvas = document.getElementById("networkCanvas");
if (!carCanvas || !networkCanvas) throw new Error("Canvas elements not found");

const carCtx = carCanvas.getContext("2d");
const networkCtx = networkCanvas.getContext("2d");

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
  historyList: document.getElementById("historyList"),
  historySummary: document.getElementById("historySummary"),
  saveBrain: document.getElementById("saveBrain"),
  resetGeneration: document.getElementById("resetGeneration"),
  discardBrain: document.getElementById("discardBrain"),
  pauseResume: document.getElementById("pauseResume"),
  exportBrain: document.getElementById("exportBrain"),
  importBrain: document.getElementById("importBrain"),
  importBrainFile: document.getElementById("importBrainFile"),
  applySettings: document.getElementById("applySettings"),
  syncHistory: document.getElementById("syncHistory"),
  toggleSensors: document.getElementById("toggleSensors"),
  toggleGhosts: document.getElementById("toggleGhosts"),
  toggleNetwork: document.getElementById("toggleNetwork"),
  speedSelect: document.getElementById("speedSelect"),
  autoResetToggle: document.getElementById("autoResetToggle"),
  autoSaveToggle: document.getElementById("autoSaveToggle"),
  populationInput: document.getElementById("populationInput"),
  trafficInput: document.getElementById("trafficInput"),
  mutationInput: document.getElementById("mutationInput"),
  lanesInput: document.getElementById("lanesInput"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  apiKey: document.getElementById("apiKey"),
  presets: Array.from(document.querySelectorAll("[data-preset]")),
};

class AppController {
  constructor() {
    this.brainStore = new BrainStore();
    const apiCfg = SafeStorage.readJSON(STORAGE_KEYS.api, { baseUrl: "", apiKey: "" });
    this.apiClient = new RunApiClient(apiCfg);
    this.historyStore = new HistoryStore(this.apiClient);

    const persisted = SafeStorage.readJSON(STORAGE_KEYS.settings, {});
    this.config = this.#mergeConfig(DEFAULT_CONFIG, persisted);
    this.engine = new SimulationEngine(this.config);
    this.savedBrain = this.brainStore.load();

    this.sim = {
      showSensors: true,
      showGhosts: true,
      showNetwork: true,
      paused: false,
      speedSteps: 1,
      autoSaveBest: false,
    };
    this.carCanvasSize = { width: 0, height: 0 };
    this.networkCanvasSize = { width: 0, height: 0 };
    this.lastFrameTime = performance.now();
    this.smoothedFps = 60;
    this.lastFpsUpdate = 0;
    this.statusOverride = null;
    this.statusOverrideUntil = 0;
    this.networkTick = 0;
    this.lastDrawnBrain = null;
  }

  init() {
    this.#hydrateUi();
    this.#bindEvents();
    this.#resizeCanvases();
    this.engine.initialize(this.savedBrain);
    updateText(ui.population, this.config.population);
    updateText(ui.generation, this.engine.generation);
    this.#updateSimSpeed(this.sim.speedSteps);
    this.#renderHistory();
    this.#refreshStatus("Simulacao ativa", "running");
    requestAnimationFrame((ts) => this.#animate(ts));
  }
  #bindEvents() {
    ui.saveBrain?.addEventListener("click", () => this.#saveBestBrain());
    ui.discardBrain?.addEventListener("click", () => this.#discardBrain());
    ui.resetGeneration?.addEventListener("click", () => this.#advanceGeneration("manual"));
    ui.pauseResume?.addEventListener("click", () => this.#togglePause());
    ui.applySettings?.addEventListener("click", () => this.#applySettingsFromForm());

    ui.exportBrain?.addEventListener("click", () => {
      const brain = this.engine.bestCar?.brain || this.savedBrain;
      this.brainStore.export(brain)
        ? this.#setTransientStatus("Cerebro exportado", "running", 2400)
        : this.#setTransientStatus("Nada para exportar", "error", 2600);
    });

    ui.importBrain?.addEventListener("click", () => ui.importBrainFile?.click());
    ui.importBrainFile?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        this.savedBrain = await this.brainStore.importFile(file);
        this.#setTransientStatus("Cerebro importado", "running", 2400);
        this.#advanceGeneration("brain-import");
      } catch {
        this.#setTransientStatus("Falha ao importar cerebro", "error", 3200);
      } finally {
        event.target.value = "";
      }
    });

    ui.toggleSensors?.addEventListener("change", (event) => {
      this.sim.showSensors = Boolean(event.target.checked);
    });
    ui.toggleGhosts?.addEventListener("change", (event) => {
      this.sim.showGhosts = Boolean(event.target.checked);
    });
    ui.toggleNetwork?.addEventListener("change", (event) => {
      this.sim.showNetwork = Boolean(event.target.checked);
    });

    ui.autoResetToggle?.addEventListener("change", (event) => {
      this.config.autoResetOnExtinction = Boolean(event.target.checked);
      this.engine.applyConfig({ autoResetOnExtinction: this.config.autoResetOnExtinction });
      this.#persistSettings();
    });

    ui.autoSaveToggle?.addEventListener("change", (event) => {
      this.sim.autoSaveBest = Boolean(event.target.checked);
      this.#persistSettings();
    });
    ui.speedSelect?.addEventListener("change", (event) =>
      this.#updateSimSpeed(Number(event.target.value))
    );

    ui.presets.forEach((button) =>
      button.addEventListener("click", () => this.#applyPreset(button.dataset.preset))
    );

    ui.syncHistory?.addEventListener("click", async () => {
      await this.#syncHistory();
    });
    window.addEventListener("resize", () => this.#resizeCanvases());

    window.addEventListener("keydown", (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          this.#togglePause();
          break;
        case "r":
          this.#advanceGeneration("manual");
          break;
        case "s":
          this.#saveBestBrain();
          break;
        default:
          break;
      }
    });
  }

  #mergeConfig(base, persisted) {
    const cfg = { ...base, ...persisted };
    cfg.population = clamp(
      cfg.population,
      LIMITS.population.min,
      LIMITS.population.max,
      base.population
    );
    cfg.trafficCount = clamp(
      cfg.trafficCount,
      LIMITS.trafficCount.min,
      LIMITS.trafficCount.max,
      base.trafficCount
    );
    cfg.mutationRate = clamp(
      cfg.mutationRate,
      LIMITS.mutationRate.min,
      LIMITS.mutationRate.max,
      base.mutationRate
    );
    cfg.laneCount = clamp(
      cfg.laneCount,
      LIMITS.laneCount.min,
      LIMITS.laneCount.max,
      base.laneCount
    );
    cfg.autoResetOnExtinction = cfg.autoResetOnExtinction !== false;
    return cfg;
  }

  #hydrateUi() {
    if (ui.populationInput) ui.populationInput.value = String(this.config.population);
    if (ui.trafficInput) ui.trafficInput.value = String(this.config.trafficCount);
    if (ui.mutationInput) ui.mutationInput.value = String(this.config.mutationRate);
    if (ui.lanesInput) ui.lanesInput.value = String(this.config.laneCount);
    if (ui.autoResetToggle) ui.autoResetToggle.checked = this.config.autoResetOnExtinction;

    this.sim.autoSaveBest = Boolean(SafeStorage.readJSON(STORAGE_KEYS.settings, {}).autoSaveBest);
    if (ui.autoSaveToggle) ui.autoSaveToggle.checked = this.sim.autoSaveBest;

    if (ui.apiBaseUrl) ui.apiBaseUrl.value = this.apiClient.baseUrl;
    if (ui.apiKey) ui.apiKey.value = this.apiClient.apiKey;
  }

  #persistSettings() {
    SafeStorage.writeJSON(STORAGE_KEYS.settings, {
      population: this.config.population,
      trafficCount: this.config.trafficCount,
      mutationRate: this.config.mutationRate,
      laneCount: this.config.laneCount,
      autoResetOnExtinction: this.config.autoResetOnExtinction,
      autoSaveBest: this.sim.autoSaveBest,
    });
  }

  #persistApiConfig() {
    SafeStorage.writeJSON(STORAGE_KEYS.api, {
      baseUrl: ui.apiBaseUrl?.value?.trim() ?? "",
      apiKey: ui.apiKey?.value?.trim() ?? "",
    });
  }

  #applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    if (ui.populationInput) ui.populationInput.value = String(p.population);
    if (ui.trafficInput) ui.trafficInput.value = String(p.trafficCount);
    if (ui.mutationInput) ui.mutationInput.value = String(p.mutationRate);
    if (ui.lanesInput) ui.lanesInput.value = String(p.laneCount);
    if (ui.autoResetToggle) ui.autoResetToggle.checked = p.autoResetOnExtinction;
    this.#applySettingsFromForm();
    this.#setTransientStatus(`Preset ${name} aplicado`, "running", 2200);
  }

  #applySettingsFromForm() {
    const next = {
      population: clamp(
        ui.populationInput?.value,
        LIMITS.population.min,
        LIMITS.population.max,
        this.config.population
      ),
      trafficCount: clamp(
        ui.trafficInput?.value,
        LIMITS.trafficCount.min,
        LIMITS.trafficCount.max,
        this.config.trafficCount
      ),
      mutationRate: clamp(
        ui.mutationInput?.value,
        LIMITS.mutationRate.min,
        LIMITS.mutationRate.max,
        this.config.mutationRate
      ),
      laneCount: clamp(
        ui.lanesInput?.value,
        LIMITS.laneCount.min,
        LIMITS.laneCount.max,
        this.config.laneCount
      ),
      autoResetOnExtinction: Boolean(ui.autoResetToggle?.checked),
    };

    this.config = { ...this.config, ...next };
    this.engine.applyConfig(this.config);
    this.#persistSettings();
    this.#resizeCanvases();
    this.#advanceGeneration("settings");
    updateText(ui.population, this.config.population);
    this.#setTransientStatus("Parametros aplicados", "running", 2200);
  }

  #updateSimSpeed(val) {
    this.sim.speedSteps = clamp(val, 1, 8, 1);
    updateText(ui.simSpeed, `${this.sim.speedSteps}x`);
  }
  #togglePause() {
    this.sim.paused = !this.sim.paused;
    if (ui.pauseResume) ui.pauseResume.textContent = this.sim.paused ? "Retomar" : "Pausar";
  }

  #saveBestBrain() {
    const best = this.engine.bestCar?.brain;
    if (!best) {
      this.#setTransientStatus("Sem cerebro para salvar", "error", 2600);
      return;
    }
    this.savedBrain = this.brainStore.save(best);
    this.#setTransientStatus("Melhor cerebro salvo", "running", 2200);
  }

  #discardBrain() {
    this.savedBrain = null;
    this.brainStore.clear();
    this.#setTransientStatus("Cerebro salvo removido", "running", 2200);
  }

  #advanceGeneration(reason) {
    const now = performance.now();
    if (this.sim.autoSaveBest && this.engine.bestCar?.brain)
      this.savedBrain = this.brainStore.save(this.engine.bestCar.brain);

    const report = this.engine.resetGeneration({
      savedBrain: this.savedBrain,
      reason,
      timestamp: now,
      keepTraffic: false,
    });
    if (report.bestDistance > 0) {
      this.historyStore.add(report);
      this.#renderHistory();
      if (this.apiClient.hasEndpoint) this.apiClient.createRun(report).catch(() => {});
    }

    updateText(ui.generation, this.engine.generation);
    updateText(ui.population, this.config.population);
    this.lastDrawnBrain = null;
  }

  async #syncHistory() {
    this.apiClient.setConfig({
      baseUrl: ui.apiBaseUrl?.value ?? "",
      apiKey: ui.apiKey?.value ?? "",
    });
    this.#persistApiConfig();
    if (!this.apiClient.hasEndpoint) {
      this.#setTransientStatus("Informe uma API URL valida", "error", 2800);
      return;
    }

    this.#setTransientStatus("Sincronizando historico...", "syncing", 3200);
    try {
      const result = await this.historyStore.syncRemote(12);
      this.#renderHistory();
      this.#setTransientStatus(
        `Sync concluido: ${result.synced} enviados, ${result.merged} recebidos`,
        "running",
        3200
      );
    } catch {
      this.#setTransientStatus("Falha na sincronizacao", "error", 3200);
    }
  }
  #renderHistory() {
    if (!ui.historyList) return;
    ui.historyList.innerHTML = "";
    const entries = this.historyStore.getTop(8);

    if (entries.length === 0) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Nenhuma geracao encerrada ainda.";
      ui.historyList.appendChild(empty);
      updateText(ui.historySummary, this.historyStore.summary());
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "history-item";
      const main = document.createElement("div");
      main.className = "history-main";
      const generationLabel = document.createElement("strong");
      generationLabel.textContent = `G${entry.generation}`;
      const distanceLabel = document.createElement("span");
      distanceLabel.textContent = fmtDist(entry.bestDistance);
      main.appendChild(generationLabel);
      main.appendChild(distanceLabel);
      const meta = document.createElement("div");
      meta.className = "history-meta";
      [
        `duracao ${fmtDuration(entry.durationMs)}`,
        `pico vivos ${entry.alivePeak}`,
        `motivo ${entry.reason}`,
        fmtDate(entry.endedAt),
      ].forEach((value) => {
        const tag = document.createElement("span");
        tag.textContent = value;
        meta.appendChild(tag);
      });
      item.appendChild(main);
      item.appendChild(meta);
      ui.historyList.appendChild(item);
    });

    updateText(ui.historySummary, this.historyStore.summary());
  }

  #resizeCanvases() {
    this.carCanvasSize = this.#resizeCanvas(carCanvas, carCtx);
    this.networkCanvasSize = this.#resizeCanvas(networkCanvas, networkCtx);
    this.engine.setRoad(
      new Road(this.carCanvasSize.width / 2, this.carCanvasSize.width * 0.9, this.config.laneCount)
    );
    this.lastDrawnBrain = null;
  }

  #resizeCanvas(canvas, ctx) {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width),
      height = Math.max(1, bounds.height),
      dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  #updateFps(ts) {
    const delta = ts - this.lastFrameTime;
    this.lastFrameTime = ts;
    const instant = 1000 / Math.max(1, delta);
    this.smoothedFps = this.smoothedFps * 0.9 + instant * 0.1;
    if (ts - this.lastFpsUpdate > 250) {
      updateText(ui.fps, Math.round(this.smoothedFps));
      this.lastFpsUpdate = ts;
    }
  }

  #animate(ts) {
    this.#updateFps(ts);
    let alive = this.engine.aliveCars;

    if (!this.sim.paused) {
      for (let step = 0; step < this.sim.speedSteps; step++) {
        const result = this.engine.step(ts);
        alive = result.aliveCount;
        if (result.shouldReset) {
          this.#advanceGeneration("extinction");
          break;
        }
      }
    } else alive = this.engine.countAliveCars();

    this.#drawScene();
    updateText(ui.aliveCars, alive);
    updateText(ui.bestDistance, fmtDist(this.engine.bestDistance));
    updateText(ui.generation, this.engine.generation);
    this.#refreshStatus(this.#statusMessage(), this.#statusState());

    requestAnimationFrame((next) => this.#animate(next));
  }

  #drawScene() {
    const best = this.engine.bestCar;
    if (!best || !this.engine.road) return;

    carCtx.clearRect(0, 0, this.carCanvasSize.width, this.carCanvasSize.height);
    networkCtx.clearRect(0, 0, this.networkCanvasSize.width, this.networkCanvasSize.height);

    carCtx.save();
    carCtx.translate(0, -best.y + this.carCanvasSize.height * 0.72);
    this.engine.road.draw(carCtx);

    const minY = best.y - this.carCanvasSize.height * 1.5;
    const maxY = best.y + this.carCanvasSize.height * 0.9;
    this.engine.traffic.forEach((trafficCar) => {
      if (trafficCar.y > minY && trafficCar.y < maxY) trafficCar.draw(carCtx, COLORS.traffic);
    });

    if (this.sim.showGhosts) {
      carCtx.globalAlpha = 0.17;
      this.engine.cars.forEach((car) => {
        if (car !== best) car.draw(carCtx, COLORS.ghost);
      });
      carCtx.globalAlpha = 1;
    }

    best.draw(carCtx, COLORS.best, this.sim.showSensors);
    carCtx.restore();

    if (this.sim.paused) this.#drawPausedOverlay();

    if (!this.sim.showNetwork) {
      this.#drawNetworkPlaceholder("Network hidden");
      return;
    }

    this.networkTick++;
    const skip = this.sim.speedSteps >= 4 ? 2 : 1;
    if (this.networkTick % skip === 0 || this.lastDrawnBrain !== best.brain) {
      Visualizer.drawNetwork(networkCtx, best.brain);
      this.lastDrawnBrain = best.brain;
    }
  }

  #drawPausedOverlay() {
    carCtx.save();
    carCtx.fillStyle = "rgba(7, 11, 18, 0.6)";
    carCtx.fillRect(0, 0, this.carCanvasSize.width, this.carCanvasSize.height);
    carCtx.fillStyle = "#edf6ff";
    carCtx.font = "600 20px 'Syne', 'Segoe UI', sans-serif";
    carCtx.textAlign = "center";
    carCtx.textBaseline = "middle";
    carCtx.fillText(
      "Simulacao pausada",
      this.carCanvasSize.width / 2,
      this.carCanvasSize.height / 2
    );
    carCtx.restore();
  }

  #drawNetworkPlaceholder(text) {
    networkCtx.save();
    networkCtx.fillStyle = "rgba(7, 12, 20, 0.8)";
    networkCtx.fillRect(0, 0, this.networkCanvasSize.width, this.networkCanvasSize.height);
    networkCtx.fillStyle = "#9ab2c7";
    networkCtx.font = "600 16px 'Syne', 'Segoe UI', sans-serif";
    networkCtx.textAlign = "center";
    networkCtx.textBaseline = "middle";
    networkCtx.fillText(text, this.networkCanvasSize.width / 2, this.networkCanvasSize.height / 2);
    networkCtx.restore();
  }

  #setTransientStatus(message, state, duration) {
    this.statusOverride = { message, state };
    this.statusOverrideUntil = performance.now() + duration;
  }

  #statusState() {
    if (this.statusOverride && performance.now() < this.statusOverrideUntil)
      return this.statusOverride.state;
    this.statusOverride = null;
    return this.sim.paused ? "paused" : "running";
  }
  #statusMessage() {
    if (this.statusOverride && performance.now() < this.statusOverrideUntil)
      return this.statusOverride.message;
    return this.sim.paused ? "Simulacao pausada" : "Simulacao ativa";
  }

  #refreshStatus(message, state) {
    updateText(ui.simStatus, message);
    if (ui.statusDot) ui.statusDot.dataset.state = state;
    if (ui.roadBadge) ui.roadBadge.textContent = this.sim.paused ? "Paused" : "Live";
    if (ui.networkBadge)
      ui.networkBadge.textContent = this.sim.showNetwork
        ? this.sim.paused
          ? "Paused"
          : "Live"
        : "Off";
  }
}

const app = new AppController();
app.init();
