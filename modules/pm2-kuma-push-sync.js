#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const KUMA_PUSH_BASE_URL = process.env.KUMA_PUSH_BASE_URL || "http://127.0.0.1:3011/api/push";
const LOOP_INTERVAL_MS = Number(process.env.KUMA_PUSH_LOOP_MS) || 60000;
const PUSH_RETRIES = Number(process.env.KUMA_PUSH_RETRIES) || 3;
const PUSH_RETRY_DELAY_MS = Number(process.env.KUMA_PUSH_RETRY_DELAY_MS) || 2000;
const FETCH_TIMEOUT_MS = Number(process.env.KUMA_PUSH_FETCH_TIMEOUT_MS) || 15000;
const PUSH_CONCURRENCY = Number(process.env.KUMA_PUSH_CONCURRENCY) || 10;

const DB_CONFIG_PATH = path.join(__dirname, "..", "data", "db-config.json");

/**
 * Read Kuma's data/db-config.json from disk and return the parsed credentials.
 * The helper relies on the same JSON file Kuma writes during setup so we never
 * keep a second copy of the database password in this module's environment.
 * @returns {{ username: string, password: string, dbName: string }} Parsed credentials.
 * @throws {Error} If the file is unreadable, malformed JSON, or missing required keys.
 */
function loadDbConfig() {
    const raw = fs.readFileSync(DB_CONFIG_PATH, "utf8");
    const config = JSON.parse(raw);
    if (!config.username || !config.password || !config.dbName) {
        throw new Error("db-config.json is missing database credentials");
    }
    return config;
}

/**
 * Single-quote a value for safe interpolation into a shell command. Embedded
 * single quotes are escaped using the standard `'\''` close-reopen idiom.
 * @param {unknown} value Value coerced to string before quoting.
 * @returns {string} Safely-quoted shell token, including surrounding quotes.
 */
function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Run a shell command synchronously and return its stdout. Stderr is captured
 * but not echoed; failures bubble up as exceptions from `execSync`.
 * @param {string} command Shell command to execute (already quoted by caller).
 * @returns {string} Command stdout decoded as UTF-8.
 */
function runCommand(command) {
    return execSync(command, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
    });
}

/**
 * Execute a SQL statement against Kuma's MariaDB using the credentials from
 * db-config.json. Output is tab-separated (-B) with no headers (-N) so callers
 * can split and parse without dealing with column titles.
 * @param {string} sql SQL statement to execute.
 * @returns {string} Tab-separated query output, one row per line.
 */
function runMariaDb(sql) {
    const db = loadDbConfig();
    const command = `mariadb -u ${shellQuote(db.username)} -p${shellQuote(db.password)} -D ${shellQuote(db.dbName)} -N -B -e ${shellQuote(sql)}`;
    return runCommand(command);
}

/**
 * Snapshot the live PM2 process list and reduce it to a name->status map.
 * If the same name appears under multiple PM2 ids (e.g. cluster mode), prefer
 * an "online" entry over any stopped/errored one so a partially healthy app
 * does not look fully dead to the status page.
 * @returns {Map<string, string>} Map of PM2 app name to its current status.
 */
function getPm2StateMap() {
    const raw = runCommand("pm2 jlist");
    const apps = JSON.parse(raw);
    const states = new Map();

    for (const app of apps) {
        if (!app || !app.name) {
            continue;
        }
        const status = String(app.pm2_env?.status || "unknown");
        const prev = states.get(app.name);
        if (status === "online" || prev !== "online") {
            states.set(app.name, status);
        }
    }

    return states;
}

/**
 * Fetch every active PM2-* push monitor from Kuma's database. Each row is
 * normalized into the shape `sendPush()` expects: the monitor's display name,
 * its push token, and the bare PM2 app name (display name minus the "PM2 "
 * prefix) so we can match it against `pm2 jlist` output.
 * @returns {{ name: string, token: string, appName: string }[]} Push monitors with non-empty tokens.
 */
function getPm2PushMonitors() {
    const sql = "SELECT name, push_token FROM monitor WHERE type='push' AND active=1 AND name LIKE 'PM2 %';";

    return runMariaDb(sql)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split("\t");
            const name = parts[0] || "";
            const token = (parts[1] || "").trim();
            return {
                name,
                token,
                appName: name.replace(/^PM2\s+/, ""),
            };
        })
        .filter((monitor) => monitor.name && monitor.token);
}

/**
 * Promise-based sleep used for retry back-off between push attempts.
 * @param {number} ms Milliseconds to wait before resolving.
 * @returns {Promise<void>} Promise that resolves once the timeout fires.
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a fetch() error for logs. Node 18+ wraps the underlying socket
 * error in `error.cause`, so the bare message is almost always just
 * "fetch failed" with no actionable detail. Surface code/syscall/address
 * so we can tell ECONNREFUSED / ETIMEDOUT / EPIPE / etc. apart.
 * @param {unknown} error Error thrown by fetch() (Error instance or anything else).
 * @returns {string} Human-readable single-line summary suitable for a log file.
 */
function describeFetchError(error) {
    if (!error) {
        return "unknown";
    }
    const msg = error instanceof Error ? error.message : String(error);
    const cause = (error && error.cause) || null;
    if (!cause) {
        return msg;
    }
    const code = cause.code || cause.errno || "?";
    const causeMsg = cause.message || String(cause);
    return `${msg} [${code}] ${causeMsg}`;
}

/**
 * Send a single push to Kuma with bounded total time.
 *
 * Each attempt is wrapped in an AbortController + timer so a hung
 * connection (e.g. when MariaDB is locked up by another tenant) cannot
 * keep the request open indefinitely. Without this, fetch() inherits
 * Undici's default headersTimeout and the helper's loop eventually
 * stacks under load.
 * @param {string} token Push token of the target Kuma monitor.
 * @param {string} status Either "up" or "down" per Kuma's push API.
 * @param {string} message Free-form status text shown in the heartbeat row.
 * @param {number} pingMs Reported round-trip time in milliseconds.
 * @returns {Promise<void>} Resolves on first 2xx response; rejects after all retries fail.
 */
async function sendPush(token, status, message, pingMs) {
    const url = `${KUMA_PUSH_BASE_URL}/${encodeURIComponent(token)}?status=${encodeURIComponent(status)}&msg=${encodeURIComponent(message)}&ping=${encodeURIComponent(String(pingMs))}`;

    let lastError = null;
    for (let attempt = 1; attempt <= PUSH_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(
            () => controller.abort(new Error(`timeout after ${FETCH_TIMEOUT_MS} ms`)),
            FETCH_TIMEOUT_MS
        );

        try {
            const response = await fetch(url, { method: "GET", signal: controller.signal });
            if (response.ok) {
                return;
            }

            let detail = "";
            try {
                const body = await response.json();
                detail = body && body.msg ? `: ${body.msg}` : "";
            } catch (parseError) {
                detail = "";
            }

            lastError = new Error(`Push failed (${response.status})${detail}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        } finally {
            clearTimeout(timer);
        }

        if (attempt < PUSH_RETRIES) {
            await sleep(PUSH_RETRY_DELAY_MS);
        }
    }

    throw lastError || new Error("Push failed");
}

/**
 * Run async work over a list with at most `limit` tasks in flight at once.
 * The original helper awaited each fetch sequentially, which made one
 * sync pass over 33 monitors take ~165 s under DB load and cause the
 * outer setInterval to stack overlapping loops. With a small worker
 * pool the same 33 pushes finish in roughly max(per_call) * (N / limit).
 * @template T
 * @param {T[]} items Items to process; each is passed to the worker exactly once.
 * @param {number} limit Maximum number of worker promises in flight at the same time.
 * @param {(item: T) => Promise<void>} worker Async callback invoked once per item.
 * @returns {Promise<void>} Resolves once every item has been processed (or thrown).
 */
async function runWithConcurrency(items, limit, worker) {
    let cursor = 0;
    const runners = [];
    const safeLimit = Math.max(1, Math.min(limit, items.length));

    for (let i = 0; i < safeLimit; i++) {
        runners.push(
            (async () => {
                while (true) {
                    const idx = cursor++;
                    if (idx >= items.length) {
                        return;
                    }
                    await worker(items[idx]);
                }
            })()
        );
    }

    await Promise.all(runners);
}

let syncRunning = false;
let consecutiveFailureLogs = 0;

/**
 * Run a single full sync pass: read PM2 state, query all push monitors, and
 * push each monitor's current up/down status to Kuma using a bounded worker
 * pool. Acquires the `syncRunning` flag for the duration so overlapping
 * setInterval ticks (during slow loops) cannot stack on top of each other.
 * @returns {Promise<void>} Resolves when the pass is complete or skipped.
 */
async function syncOnce() {
    if (syncRunning) {
        // Skip rather than stack: if MariaDB or Kuma are slow, queueing
        // another full pass on top of a still-running one only deepens
        // the contention. Lost pushes are recovered on the next tick.
        process.stderr.write("[pm2-kuma-push-sync] previous sync still running, skipping this tick\n");
        return;
    }
    syncRunning = true;

    const startedAt = Date.now();
    let okCount = 0;
    let failCount = 0;
    const errorSummary = new Map(); // appName -> last error description

    try {
        const pm2States = getPm2StateMap();
        const monitors = getPm2PushMonitors();

        await runWithConcurrency(monitors, PUSH_CONCURRENCY, async (monitor) => {
            const state = pm2States.get(monitor.appName) || "missing";
            const isUp = state === "online";
            const status = isUp ? "up" : "down";
            const message = isUp ? `PM2 ${monitor.appName} online` : `PM2 ${monitor.appName} ${state}`;
            const ping = isUp ? 50 : 0;

            try {
                await sendPush(monitor.token, status, message, ping);
                okCount += 1;
            } catch (error) {
                failCount += 1;
                errorSummary.set(monitor.appName, describeFetchError(error));
            }
        });

        const elapsed = Date.now() - startedAt;
        if (failCount === 0) {
            consecutiveFailureLogs = 0;
            process.stdout.write(`[pm2-kuma-push-sync] ok ${okCount}/${monitors.length} in ${elapsed} ms\n`);
        } else {
            // Avoid log spam: when Kuma's /api/push is slow because of
            // unrelated MariaDB contention, every monitor will fail
            // every loop. After 3 consecutive failing loops, summarise
            // instead of dumping every monitor name on every minute.
            consecutiveFailureLogs += 1;
            if (consecutiveFailureLogs <= 3) {
                process.stderr.write(`[pm2-kuma-push-sync] ${okCount} ok, ${failCount} fail in ${elapsed} ms\n`);
                for (const [name, detail] of errorSummary) {
                    process.stderr.write(`[pm2-kuma-push-sync]   ${name}: ${detail}\n`);
                }
            } else if (consecutiveFailureLogs % 10 === 0) {
                const sample = errorSummary.entries().next().value;
                const sampleStr = sample ? `${sample[0]}: ${sample[1]}` : "n/a";
                process.stderr.write(
                    `[pm2-kuma-push-sync] still failing for ${consecutiveFailureLogs} loops, ${failCount}/${monitors.length} this tick. Sample: ${sampleStr}\n`
                );
            }
        }
    } finally {
        syncRunning = false;
    }
}

/**
 * Entry point: log the active configuration, run an immediate sync so the
 * status page does not have to wait a full interval before the first push,
 * then schedule recurring syncs at LOOP_INTERVAL_MS.
 * @returns {Promise<void>} Resolves once the initial sync completes; the
 *   recurring timer keeps the process alive after that.
 */
async function main() {
    process.stdout.write(
        `[pm2-kuma-push-sync] starting (loop=${LOOP_INTERVAL_MS}ms concurrency=${PUSH_CONCURRENCY} fetch_timeout=${FETCH_TIMEOUT_MS}ms)\n`
    );
    await syncOnce();
    setInterval(() => {
        syncOnce().catch((error) => {
            const messageText = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[pm2-kuma-push-sync] loop error: ${messageText}\n`);
        });
    }, LOOP_INTERVAL_MS);
}

main().catch((error) => {
    const messageText = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[pm2-kuma-push-sync] fatal: ${messageText}\n`);
    process.exit(1);
});
