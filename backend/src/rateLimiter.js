class RateLimiter {
    constructor({ windowMs, max }) {
        this.windowMs = windowMs;
        this.max = max;
        this.store = new Map();
    }

    consume(identity, now = Date.now()) {
        const key = identity || "unknown";
        const current = this.store.get(key);

        if (!current || now >= current.resetAt) {
            const next = {
                count: 1,
                resetAt: now + this.windowMs
            };
            this.store.set(key, next);
            return {
                allowed: true,
                remaining: Math.max(0, this.max - 1),
                retryAfterMs: 0
            };
        }

        current.count += 1;
        this.store.set(key, current);

        if (current.count > this.max) {
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(0, current.resetAt - now)
            };
        }

        return {
            allowed: true,
            remaining: Math.max(0, this.max - current.count),
            retryAfterMs: 0
        };
    }

    sweep(now = Date.now()) {
        for (const [key, value] of this.store.entries()) {
            if (now >= value.resetAt) {
                this.store.delete(key);
            }
        }
    }
}

module.exports = {
    RateLimiter
};
