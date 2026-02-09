const path = require("path");

function toInt(value, fallback) {
    const numeric = Number.parseInt(value, 10);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function toNonNegativeInt(value, fallback) {
    const numeric = toInt(value, fallback);
    return numeric >= 0 ? numeric : fallback;
}

function loadConfig(overrides = {}) {
    const rootDir = path.resolve(__dirname, "..");

    const envConfig = {
        host: process.env.HOST || "0.0.0.0",
        port: toInt(process.env.PORT, 8787),
        dataFile: process.env.DATA_FILE || path.join(rootDir, "data", "runs.json"),
        apiKey: process.env.API_KEY || "",
        adminKey: process.env.ADMIN_KEY || "",
        allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
        rateLimitWindowMs: toNonNegativeInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
        rateLimitMax: toNonNegativeInt(process.env.RATE_LIMIT_MAX, 120),
        maxBodyBytes: toNonNegativeInt(process.env.MAX_BODY_BYTES, 65536),
        maxRuns: toNonNegativeInt(process.env.MAX_RUNS, 1000)
    };

    return {
        ...envConfig,
        ...overrides
    };
}

module.exports = {
    loadConfig
};
