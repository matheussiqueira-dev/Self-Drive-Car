const fs = require("fs/promises");
const path = require("path");

class RunRepository {
    constructor({ filePath, maxRuns }) {
        this.filePath = filePath;
        this.maxRuns = maxRuns;
        this.writeLock = Promise.resolve();
    }

    async init() {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });

        try {
            await fs.access(this.filePath);
        } catch {
            await fs.writeFile(this.filePath, "[]", "utf8");
        }
    }

    async list(limit = 20) {
        const items = await this.#readAll();
        return items
            .slice()
            .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())
            .slice(0, Math.max(1, limit));
    }

    async create(run) {
        return this.#withLock(async () => {
            const current = await this.#readAll();
            current.unshift(run);
            const next = current.slice(0, this.maxRuns);
            await this.#writeAll(next);
            return run;
        });
    }

    async remove(id) {
        return this.#withLock(async () => {
            const current = await this.#readAll();
            const filtered = current.filter((entry) => entry.id !== id);
            const removed = current.length - filtered.length;

            if (removed > 0) {
                await this.#writeAll(filtered);
            }

            return removed;
        });
    }

    async #readAll() {
        try {
            const raw = await fs.readFile(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    async #writeAll(entries) {
        await fs.writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf8");
    }

    #withLock(task) {
        this.writeLock = this.writeLock.then(task, task);
        return this.writeLock;
    }
}

module.exports = {
    RunRepository
};
