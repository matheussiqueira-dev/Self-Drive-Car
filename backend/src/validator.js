const ALLOWED_REASONS = new Set(["manual", "extinction", "settings", "brain-import"]);

function asNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function inRange(value, min, max) {
    return value >= min && value <= max;
}

function parseRunPayload(payload) {
    const errors = [];

    if (!payload || typeof payload !== "object") {
        return {
            ok: false,
            errors: ["payload must be an object"]
        };
    }

    const generation = asNumber(payload.generation);
    if (generation === null || !Number.isInteger(generation) || !inRange(generation, 1, 1000000)) {
        errors.push("generation must be an integer between 1 and 1000000");
    }

    const bestDistance = asNumber(payload.bestDistance);
    if (bestDistance === null || !inRange(bestDistance, 0, 1000000000)) {
        errors.push("bestDistance must be between 0 and 1000000000");
    }

    const averageFitness = asNumber(payload.averageFitness);
    if (averageFitness === null || !inRange(averageFitness, -1000000000, 1000000000)) {
        errors.push("averageFitness must be a finite number");
    }

    const alivePeak = asNumber(payload.alivePeak);
    if (alivePeak === null || !Number.isInteger(alivePeak) || !inRange(alivePeak, 0, 10000)) {
        errors.push("alivePeak must be an integer between 0 and 10000");
    }

    const durationMs = asNumber(payload.durationMs);
    if (durationMs === null || !inRange(durationMs, 0, 86400000)) {
        errors.push("durationMs must be between 0 and 86400000");
    }

    const reason = typeof payload.reason === "string" ? payload.reason : "manual";
    if (!ALLOWED_REASONS.has(reason)) {
        errors.push("reason is invalid");
    }

    const endedAt = typeof payload.endedAt === "string" ? payload.endedAt : new Date().toISOString();
    if (Number.isNaN(Date.parse(endedAt))) {
        errors.push("endedAt must be a valid ISO date");
    }

    const config = payload.config;
    if (!config || typeof config !== "object") {
        errors.push("config must be an object");
    }

    const population = asNumber(config?.population);
    if (population === null || !Number.isInteger(population) || !inRange(population, 20, 300)) {
        errors.push("config.population must be between 20 and 300");
    }

    const trafficCount = asNumber(config?.trafficCount);
    if (trafficCount === null || !Number.isInteger(trafficCount) || !inRange(trafficCount, 10, 200)) {
        errors.push("config.trafficCount must be between 10 and 200");
    }

    const mutationRate = asNumber(config?.mutationRate);
    if (mutationRate === null || !inRange(mutationRate, 0.01, 0.5)) {
        errors.push("config.mutationRate must be between 0.01 and 0.5");
    }

    const laneCount = asNumber(config?.laneCount);
    if (laneCount === null || !Number.isInteger(laneCount) || !inRange(laneCount, 2, 5)) {
        errors.push("config.laneCount must be between 2 and 5");
    }

    if (errors.length > 0) {
        return {
            ok: false,
            errors
        };
    }

    return {
        ok: true,
        value: {
            id: typeof payload.id === "string" && payload.id.trim().length > 0
                ? payload.id.trim().slice(0, 80)
                : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            generation,
            bestDistance,
            averageFitness,
            alivePeak,
            durationMs,
            reason,
            endedAt,
            config: {
                population,
                trafficCount,
                mutationRate,
                laneCount
            }
        }
    };
}

module.exports = {
    parseRunPayload,
    ALLOWED_REASONS
};
