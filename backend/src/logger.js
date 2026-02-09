function log(level, event, details = {}) {
    const payload = {
        level,
        event,
        timestamp: new Date().toISOString(),
        ...details
    };

    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
    } else {
        console.log(line);
    }
}

module.exports = {
    info(event, details) {
        log("info", event, details);
    },
    warn(event, details) {
        log("warn", event, details);
    },
    error(event, details) {
        log("error", event, details);
    }
};
