const fs = require("node:fs/promises");
const path = require("node:path");
const { buildState, SNAPSHOT_INTERVAL_MS } = require("./metrics-model");

const outputDir = path.resolve(__dirname, "../../public/tokenfleet-data");
const outputPath = path.join(outputDir, "current-state.json");
const startedAt = Date.now();

/**
 * Write the latest TokenFleet state snapshot.
 * @returns {Promise<void>} Completes after the file has been written.
 */
async function writeSnapshot() {
    const state = buildState({ startedAt, now: new Date() });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    process.stdout.write(`[tokenfleet] ${state.meta.updatedAt} ${state.meta.stage} -> ${outputPath}\n`);
}

writeSnapshot().catch((error) => {
    console.error("[tokenfleet] failed to write initial state", error);
    process.exitCode = 1;
});

const timer = setInterval(() => {
    writeSnapshot().catch((error) => {
        console.error("[tokenfleet] failed to write state", error);
    });
}, SNAPSHOT_INTERVAL_MS);

/**
 * Stop the feed process cleanly.
 * @returns {void}
 */
function shutdown() {
    clearInterval(timer);
    process.stdout.write("[tokenfleet] feed stopped\n");
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
