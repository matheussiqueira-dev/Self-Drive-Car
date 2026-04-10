const { createServer } = require("./server");
const logger = require("./logger");

const app = createServer();

app.start().catch((error) => {
  logger.error("server.start.failed", { message: error.message });
  process.exitCode = 1;
});

async function shutdown(signal) {
  logger.info("server.shutdown.requested", { signal });
  try {
    await app.stop();
    logger.info("server.shutdown.completed");
    process.exit(0);
  } catch (error) {
    logger.error("server.shutdown.failed", { message: error.message });
    process.exit(1);
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
