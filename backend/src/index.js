const { createServer } = require("./server");

const app = createServer();

app.start().catch((error) => {
    console.error(JSON.stringify({
        level: "error",
        event: "server.start.failed",
        message: error.message,
        timestamp: new Date().toISOString()
    }));
    process.exitCode = 1;
});
