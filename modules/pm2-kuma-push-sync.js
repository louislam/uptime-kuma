#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const KUMA_PUSH_BASE_URL = "http://127.0.0.1:3011/api/push";
const LOOP_INTERVAL_MS = 60000;
const PUSH_RETRIES = 3;
const PUSH_RETRY_DELAY_MS = 2000;

const DB_CONFIG_PATH = path.join(__dirname, "..", "data", "db-config.json");

function loadDbConfig() {
    const raw = fs.readFileSync(DB_CONFIG_PATH, "utf8");
    const config = JSON.parse(raw);
    if (!config.username || !config.password || !config.dbName) {
        throw new Error("db-config.json is missing database credentials");
    }
    return config;
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runCommand(command) {
    return execSync(command, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
    });
}

function runMariaDb(sql) {
    const db = loadDbConfig();
    const command = `mariadb -u ${shellQuote(db.username)} -p${shellQuote(db.password)} -D ${shellQuote(db.dbName)} -N -B -e ${shellQuote(sql)}`;
    return runCommand(command);
}

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPush(token, status, message, pingMs) {
    const url = `${KUMA_PUSH_BASE_URL}/${encodeURIComponent(token)}?status=${encodeURIComponent(status)}&msg=${encodeURIComponent(message)}&ping=${encodeURIComponent(String(pingMs))}`;

    let lastError = null;
    for (let attempt = 1; attempt <= PUSH_RETRIES; attempt++) {
        try {
            const response = await fetch(url, { method: "GET" });
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
        }

        if (attempt < PUSH_RETRIES) {
            await sleep(PUSH_RETRY_DELAY_MS);
        }
    }

    throw lastError || new Error("Push failed");
}

async function syncOnce() {
    const pm2States = getPm2StateMap();
    const monitors = getPm2PushMonitors();

    for (const monitor of monitors) {
        const state = pm2States.get(monitor.appName) || "missing";
        const isUp = state === "online";
        const status = isUp ? "up" : "down";
        const message = isUp ? `PM2 ${monitor.appName} online` : `PM2 ${monitor.appName} ${state}`;
        const ping = isUp ? 50 : 0;

        try {
            await sendPush(monitor.token, status, message, ping);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[pm2-kuma-push-sync] ${monitor.appName}: ${messageText}\n`);
        }
    }
}

async function main() {
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
