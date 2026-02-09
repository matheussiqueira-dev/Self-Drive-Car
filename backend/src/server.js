const http = require("http");
const { loadConfig } = require("./config");
const { RateLimiter } = require("./rateLimiter");
const { RunRepository } = require("./runRepository");
const { parseRunPayload } = require("./validator");
const logger = require("./logger");

function sendJson(res, status, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        ...extraHeaders
    });
    res.end(body);
}

function readBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        let total = 0;
        let raw = "";

        req.setEncoding("utf8");

        req.on("data", (chunk) => {
            total += Buffer.byteLength(chunk);
            if (total > maxBytes) {
                reject(new Error("BODY_TOO_LARGE"));
                req.destroy();
                return;
            }
            raw += chunk;
        });

        req.on("end", () => {
            if (!raw) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error("INVALID_JSON"));
            }
        });

        req.on("error", reject);
    });
}

function createServer(overrides = {}) {
    const config = loadConfig(overrides);
    const repository = new RunRepository({
        filePath: config.dataFile,
        maxRuns: config.maxRuns
    });
    const limiter = new RateLimiter({
        windowMs: config.rateLimitWindowMs,
        max: config.rateLimitMax
    });

    const securityHeaders = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    };

    function applyCors(req, res) {
        const origin = req.headers.origin;
        const allowOrigin = config.allowedOrigin === "*"
            ? "*"
            : (origin && origin === config.allowedOrigin ? origin : config.allowedOrigin);

        res.setHeader("Access-Control-Allow-Origin", allowOrigin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, x-admin-key");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        Object.entries(securityHeaders).forEach(([key, value]) => res.setHeader(key, value));
    }

    function hasApiAccess(req) {
        if (!config.apiKey) {
            return true;
        }
        return req.headers["x-api-key"] === config.apiKey;
    }

    function hasAdminAccess(req) {
        if (config.adminKey) {
            return req.headers["x-admin-key"] === config.adminKey;
        }
        return hasApiAccess(req);
    }

    const server = http.createServer(async (req, res) => {
        applyCors(req, res);

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        const identity = req.socket?.remoteAddress || "unknown";
        const quota = limiter.consume(identity);
        res.setHeader("X-RateLimit-Remaining", String(quota.remaining));

        if (!quota.allowed) {
            sendJson(res, 429, {
                error: "Too many requests",
                retryAfterMs: quota.retryAfterMs
            }, {
                "Retry-After": String(Math.ceil(quota.retryAfterMs / 1000))
            });
            return;
        }

        const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
        const pathname = url.pathname;

        if (req.method === "GET" && pathname === "/api/v1/health") {
            sendJson(res, 200, {
                status: "ok",
                uptimeSeconds: Math.round(process.uptime()),
                timestamp: new Date().toISOString(),
                version: "1.0.0"
            });
            return;
        }

        if (req.method === "GET" && pathname === "/api/v1/runs") {
            if (!hasApiAccess(req)) {
                sendJson(res, 401, { error: "Unauthorized" });
                return;
            }

            const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
            const data = await repository.list(limit);
            sendJson(res, 200, {
                data,
                meta: {
                    count: data.length,
                    limit
                }
            });
            return;
        }

        if (req.method === "POST" && pathname === "/api/v1/runs") {
            if (!hasApiAccess(req)) {
                sendJson(res, 401, { error: "Unauthorized" });
                return;
            }

            try {
                const payload = await readBody(req, config.maxBodyBytes);
                const parsed = parseRunPayload(payload);

                if (!parsed.ok) {
                    sendJson(res, 422, {
                        error: "Validation error",
                        details: parsed.errors
                    });
                    return;
                }

                const created = await repository.create(parsed.value);
                sendJson(res, 201, {
                    data: created
                });
                return;
            } catch (error) {
                if (error.message === "BODY_TOO_LARGE") {
                    sendJson(res, 413, { error: "Payload too large" });
                    return;
                }

                if (error.message === "INVALID_JSON") {
                    sendJson(res, 400, { error: "Invalid JSON body" });
                    return;
                }

                logger.error("runs.create.failed", { message: error.message });
                sendJson(res, 500, { error: "Internal server error" });
                return;
            }
        }

        const deleteMatch = pathname.match(/^\/api\/v1\/runs\/([a-zA-Z0-9_-]+)$/);
        if (req.method === "DELETE" && deleteMatch) {
            if (!hasAdminAccess(req)) {
                sendJson(res, 401, { error: "Unauthorized" });
                return;
            }

            const removed = await repository.remove(deleteMatch[1]);
            if (removed === 0) {
                sendJson(res, 404, { error: "Run not found" });
                return;
            }

            sendJson(res, 200, { deleted: removed });
            return;
        }

        sendJson(res, 404, { error: "Route not found" });
    });

    async function start() {
        await repository.init();

        return new Promise((resolve) => {
            server.listen(config.port, config.host, () => {
                const address = server.address();
                const port = typeof address === "object" && address ? address.port : config.port;
                logger.info("server.started", { port, host: config.host, dataFile: config.dataFile });
                resolve({ port });
            });
        });
    }

    async function stop() {
        return new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    return {
        server,
        start,
        stop,
        config,
        repository
    };
}

module.exports = {
    createServer
};
