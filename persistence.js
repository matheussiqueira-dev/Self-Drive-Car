/**
 * Desenvolvido por Matheus Siqueira - www.matheussiqueira.dev
 */

class SafeStorage {
  static readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  static writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch {
      return false;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
}

const cloneBrain = (brain) => {
  if (!brain) return null;
  return typeof structuredClone === "function"
    ? structuredClone(brain)
    : JSON.parse(JSON.stringify(brain));
};

class BrainStore {
  load() {
    const b = SafeStorage.readJSON(STORAGE_KEYS.bestBrain, null);
    return this.#isValid(b) ? b : null;
  }

  save(brain) {
    if (!this.#isValid(brain)) return null;
    const c = cloneBrain(brain);
    SafeStorage.writeJSON(STORAGE_KEYS.bestBrain, c);
    return c;
  }

  clear() {
    SafeStorage.remove(STORAGE_KEYS.bestBrain);
  }

  export(brain) {
    if (!this.#isValid(brain)) return false;
    const payload = { version: 1, exportedAt: new Date().toISOString(), brain };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `neural-drive-brain-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return true;
  }

  async importFile(file) {
    const parsed = JSON.parse(await file.text());
    const brain = parsed?.brain ?? parsed;
    if (!this.#isValid(brain)) throw new Error("Invalid brain");
    return this.save(brain);
  }

  #isValid(candidate) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      !Array.isArray(candidate.levels) ||
      candidate.levels.length === 0
    )
      return false;
    return candidate.levels.every(
      (l) =>
        l &&
        Array.isArray(l.inputs) &&
        Array.isArray(l.outputs) &&
        Array.isArray(l.biases) &&
        Array.isArray(l.weights)
    );
  }
}

class RunApiClient {
  constructor(cfg) {
    this.setConfig(cfg);
  }

  setConfig(cfg) {
    this.baseUrl = this.#sanitize(cfg?.baseUrl);
    this.apiKey = cfg?.apiKey ? String(cfg.apiKey).trim() : "";
  }

  get hasEndpoint() {
    return Boolean(this.baseUrl);
  }

  async fetchRuns(limit = 12) {
    if (!this.hasEndpoint) return [];
    const res = await fetch(`${this.baseUrl}/api/v1/runs?limit=${limit}`, {
      headers: this.#headers(false),
    });
    if (!res.ok) throw new Error(`Fetch runs failed: ${res.status}`);
    const payload = await res.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  async createRun(run) {
    if (!this.hasEndpoint) return null;
    const res = await fetch(`${this.baseUrl}/api/v1/runs`, {
      method: "POST",
      headers: this.#headers(true),
      body: JSON.stringify(run),
    });
    if (!res.ok) throw new Error(`Create run failed: ${res.status}`);
    const payload = await res.json();
    return payload?.data ?? null;
  }

  #headers(withBody) {
    const h = { Accept: "application/json" };
    if (withBody) h["Content-Type"] = "application/json";
    if (this.apiKey) h["x-api-key"] = this.apiKey;
    return h;
  }

  #sanitize(url) {
    if (!url) return "";
    const t = String(url).trim().replace(/\/$/, "");
    try {
      const u = new URL(t);
      return u.protocol === "http:" || u.protocol === "https:"
        ? u.toString().replace(/\/$/, "")
        : "";
    } catch {
      return "";
    }
  }
}

class HistoryStore {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.entries = this.#sanitize(SafeStorage.readJSON(STORAGE_KEYS.history, []));
  }

  add(entry) {
    if (!entry || typeof entry !== "object") return;
    this.entries.unshift(entry);
    this.entries = this.#sanitize(this.entries).slice(0, 120);
    SafeStorage.writeJSON(STORAGE_KEYS.history, this.entries);
  }

  getTop(limit = 8) {
    return this.entries
      .slice()
      .sort((a, b) => b.bestDistance - a.bestDistance)
      .slice(0, limit);
  }

  summary() {
    const best = this.getTop(1)[0];
    return best
      ? `Top: ${fmtDist(best.bestDistance)} em ${this.entries.length} runs`
      : "Sem dados ainda";
  }

  merge(remote) {
    if (!Array.isArray(remote) || remote.length === 0) return 0;
    const ids = new Set(this.entries.map((e) => e.id));
    let merged = 0;
    remote.forEach((e) => {
      if (e && e.id && !ids.has(e.id)) {
        this.entries.push(e);
        ids.add(e.id);
        merged++;
      }
    });
    this.entries = this.#sanitize(this.entries).slice(0, 120);
    SafeStorage.writeJSON(STORAGE_KEYS.history, this.entries);
    return merged;
  }

  async syncRemote(limit = 12) {
    if (!this.apiClient.hasEndpoint) return { synced: 0, merged: 0 };
    let synced = 0;
    for (const run of this.entries.slice(0, limit)) {
      try {
        await this.apiClient.createRun(run);
        synced++;
      } catch {
        break;
      }
    }
    let merged = 0;
    try {
      merged = this.merge(await this.apiClient.fetchRuns(limit));
    } catch {}
    return { synced, merged };
  }

  #sanitize(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((e) => e && typeof e === "object")
      .map((e) => ({
        id: String(e.id ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
        generation: Number(e.generation) || 0,
        bestDistance: Number(e.bestDistance) || 0,
        averageFitness: Number(e.averageFitness) || 0,
        alivePeak: Number(e.alivePeak) || 0,
        durationMs: Number(e.durationMs) || 0,
        reason: String(e.reason ?? "manual"),
        endedAt: e.endedAt || new Date().toISOString(),
        config: {
          population: Number(e.config?.population) || DEFAULT_CONFIG.population,
          trafficCount: Number(e.config?.trafficCount) || DEFAULT_CONFIG.trafficCount,
          mutationRate: Number(e.config?.mutationRate) || DEFAULT_CONFIG.mutationRate,
          laneCount: Number(e.config?.laneCount) || DEFAULT_CONFIG.laneCount,
        },
      }));
  }
}
