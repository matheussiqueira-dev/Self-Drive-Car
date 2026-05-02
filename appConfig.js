/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

const STORAGE_KEYS = {
  bestBrain: "neuralDrive.bestBrain",
  settings: "neuralDrive.settings",
  history: "neuralDrive.history",
  api: "neuralDrive.api",
};

const DEFAULT_CONFIG = {
  population: 100,
  trafficCount: 50,
  laneCount: 3,
  mutationRate: 0.1,
  carWidth: 30,
  carHeight: 50,
  trafficSpeedMin: 1.2,
  trafficSpeedMax: 2.2,
  trafficMinGap: 260,
  trafficGapJitter: 220,
  startSafeDistance: 700,
  resetTrafficOnGeneration: true,
  autoResetOnExtinction: true,
  extinctionDelayMs: 700,
};

const PRESETS = {
  balanced: {
    population: 100,
    trafficCount: 50,
    mutationRate: 0.1,
    laneCount: 3,
    autoResetOnExtinction: true,
  },
  fast: {
    population: 60,
    trafficCount: 28,
    mutationRate: 0.16,
    laneCount: 3,
    autoResetOnExtinction: true,
  },
  dense: {
    population: 120,
    trafficCount: 85,
    mutationRate: 0.08,
    laneCount: 4,
    autoResetOnExtinction: true,
  },
};

const LIMITS = {
  population: { min: 20, max: 300 },
  trafficCount: { min: 10, max: 200 },
  mutationRate: { min: 0.01, max: 0.5 },
  laneCount: { min: 2, max: 5 },
};

const COLORS = { best: "#4fd0ff", ghost: "#9fb4c8", traffic: "#ff7676" };

const clamp = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const fmtDist = (v) => `${Math.max(0, Math.round(v))} m`;

const fmtDuration = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const updateText = (el, val) => {
  if (!el) return;
  const next = String(val);
  if (el.textContent !== next) el.textContent = next;
};
