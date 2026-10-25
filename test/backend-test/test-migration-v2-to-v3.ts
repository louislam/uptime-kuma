import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import BetterSqlite3 from "better-sqlite3";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fixturePath = path.join(__dirname, "../fixtures/v2-kuma.db.gz");
const dataDir = path.join(__dirname, "../../data/test-migration-v2-upgrade");

const username = "admin";

// A password that Have I Been Pwned reports as breached, to cover the migration path from #7946.
const password = "Admin123!x";

/**
 * Get a free TCP port from the OS.
 * @returns {Promise<number>} A free port
 */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

/**
 * Wait until the server answers HTTP requests.
 * @param {string} url URL to poll
 * @param {number} timeoutMs Maximum time to wait
 * @returns {Promise<void>}
 */
async function waitForServer(url, timeoutMs = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            if ((await fetch(url)).ok) {
                return;
            }
        } catch (e) {
            // Not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

/**
 * Emit a socket.io event and await its acknowledgement.
 * @param {import("socket.io-client").Socket} socket Connected socket
 * @param {string} event Event name
 * @param {any[]} args Event arguments
 * @returns {Promise<any>} Acknowledgement payload
 */
function emitAsync(socket, event, ...args) {
    return new Promise((resolve) => socket.emit(event, ...args, resolve));
}

/**
 * Assert a socket call succeeded.
 * @param {import("socket.io-client").Socket} socket Connected socket
 * @param {string} event Event name
 * @param {any[]} args Event arguments
 * @returns {Promise<any>} The acknowledgement payload
 */
async function callOk(socket, event, ...args) {
    const result = await emitAsync(socket, event, ...args);
    assert.strictEqual(result.ok, true, `${event} failed: ${result.msg}`);
    return result;
}

test("A v2.5.3 database still works after upgrading to v3 (#7944, #7946)", { timeout: 180000 }, async () => {
    assert.ok(fs.existsSync(fixturePath), `v2 fixture not found: ${fixturePath}`);

    // Start from a real 2.5.3 database (see extra/prepare-v2-test-db.mjs) and let the server
    // migrate it, exactly like a user upgrading the image with their data dir.
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "kuma.db"), zlib.gunzipSync(fs.readFileSync(fixturePath)));

    // Seed the admin with a breached password, so migrating it must skip the leak check (#7946).
    const seedDb = new BetterSqlite3(path.join(dataDir, "kuma.db"));
    seedDb.prepare("UPDATE user SET password = ? WHERE username = ?").run(await bcrypt.hash(password, 10), username);
    // The v2 database has an API key, but no setting enabling API key auth yet
    seedDb.prepare("INSERT INTO setting (`key`, `value`, `type`) VALUES ('apiKeysEnabled', 'true', 'general')").run();
    seedDb.close();

    let child;
    let socket;

    try {
        const port = await getFreePort();
        child = spawn(process.execPath, ["--import=tsx", "server/server.js"], {
            cwd: path.join(__dirname, "../.."),
            env: { ...process.env, DATA_DIR: dataDir, UPTIME_KUMA_PORT: String(port), UPTIME_KUMA_DB_TYPE: "sqlite" },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let serverOutput = "";
        child.stdout.on("data", (data) => (serverOutput += data.toString()));
        child.stderr.on("data", (data) => (serverOutput += data.toString()));

        const baseUrl = `http://127.0.0.1:${port}`;
        await waitForServer(`${baseUrl}/api/entry-page`);

        // Log in. The legacy v2 user is migrated to better-auth on the first sign-in.
        const login = await fetch(`${baseUrl}/api/auth/sign-in/username`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        assert.strictEqual(login.status, 200, `login failed: ${login.status}\n${serverOutput}`);
        const cookie = login.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; ");

        socket = io(baseUrl, { extraHeaders: { cookie }, reconnection: false });
        await new Promise((resolve, reject) => {
            socket.on("connect", resolve);
            socket.on("connect_error", reject);
        });

        // Monitors: the operations that were broken in #7944
        const monitor = (await callOk(socket, "getMonitor", 1)).monitor;
        monitor.name = "Renamed Monitor";
        await callOk(socket, "editMonitor", monitor);
        await callOk(socket, "pauseMonitor", 1);
        await callOk(socket, "resumeMonitor", 1);

        // The v2 API key (uk1_test-api-key, see extra/prepare-v2-test-db.mjs) must keep working
        const basicAuth = (key) => "Basic " + Buffer.from(`:${key}`).toString("base64");
        const metricsStatus = async (key) =>
            (await fetch(`${baseUrl}/metrics`, { headers: { authorization: basicAuth(key) } })).status;

        const apiKeyList = (await callOk(socket, "getAPIKeyList")).apiKeyList;
        assert.ok(
            apiKeyList.some((key) => key.id === "legacy-1"),
            `legacy API key not listed: ${JSON.stringify(apiKeyList)}`
        );

        // /metrics is disabled by default since v3
        assert.strictEqual(await metricsStatus("uk1_test-api-key"), 404);

        await callOk(socket, "setSettings", { prometheusApiEnabled: true }, null);

        assert.strictEqual(await metricsStatus("uk1_test-api-key"), 200);
        assert.strictEqual(await metricsStatus("uk1_wrong-key"), 401);
        // API keys are enabled on this database, so username/password is not accepted either
        const passwordAuth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
        assert.strictEqual(
            (await fetch(`${baseUrl}/metrics`, { headers: { authorization: passwordAuth } })).status,
            401
        );

        // Turning it off again hides the endpoint, even with a valid key
        await callOk(socket, "setSettings", { prometheusApiEnabled: false }, null);
        assert.strictEqual(await metricsStatus("uk1_test-api-key"), 404);
        await callOk(socket, "setSettings", { prometheusApiEnabled: true }, null);
        assert.strictEqual(await metricsStatus("uk1_test-api-key"), 200);

        // Revoking it through the API key list stops it from working
        await callOk(socket, "deleteAPIKey", "legacy-1");
        assert.strictEqual(await metricsStatus("uk1_test-api-key"), 401);

        // A key created after the upgrade is a Better Auth key, same lifecycle
        const addedKey = await callOk(socket, "addAPIKey", { name: "v3 key", expires: null });
        assert.strictEqual(await metricsStatus(addedKey.key), 200);

        const listWithNewKey = (await callOk(socket, "getAPIKeyList")).apiKeyList;
        assert.ok(
            listWithNewKey.some((key) => key.id === addedKey.keyID && key.name === "v3 key"),
            `new API key not listed: ${JSON.stringify(listWithNewKey)}`
        );

        await callOk(socket, "deleteAPIKey", addedKey.keyID);
        assert.strictEqual(await metricsStatus(addedKey.key), 401);

        // Maintenance
        const maintenance = (await callOk(socket, "getMaintenance", 1)).maintenance;
        maintenance.title = "Renamed Maintenance";
        await callOk(socket, "editMaintenance", maintenance);

        // The other resources can be updated and deleted by the logged-in user
        await callOk(
            socket,
            "addProxy",
            { protocol: "http", host: "127.0.0.1", port: 8081, auth: false, active: true, default: false },
            1
        );
        await callOk(
            socket,
            "addDockerHost",
            { dockerDaemon: "tcp://127.0.0.1:2375", dockerType: "socket", name: "Updated Docker" },
            1
        );
        await callOk(socket, "addRemoteBrowser", { name: "Updated Browser", url: "http://127.0.0.1:9222" }, 1);
        await callOk(socket, "addNotification", { name: "Updated Notif", isDefault: false, active: true }, 1);

        await callOk(socket, "deleteProxy", 1);
        await callOk(socket, "deleteDockerHost", 1);
        await callOk(socket, "deleteRemoteBrowser", 1);
        await callOk(socket, "deleteNotification", 1);
        await callOk(socket, "deleteMaintenance", 1);
        await callOk(socket, "deleteMonitor", 1);
    } finally {
        if (socket) {
            socket.close();
        }
        if (child) {
            child.kill();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
            fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
        } catch (e) {
            // Windows/Dropbox can keep a handle on the directory for a moment; the next run cleans it up
        }
    }
});
