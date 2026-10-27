const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");
const Database = require("better-sqlite3");

const repoRoot = path.join(__dirname, "../..");
const hasDist = fs.existsSync(path.join(repoRoot, "dist", "index.html"));
const PASSWORD = "Integration-Test-Pass-2026!";

let serverProcess;
let dataDir;
let base;
let apiKey;
let monitorID;
let statusPageID;

/**
 * Find a free TCP port.
 * @returns {Promise<number>} Free port
 */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.listen(0, "127.0.0.1", () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
        probe.on("error", reject);
    });
}

/**
 * Wait until the server answers on its public entry-page route.
 * @param {number} timeoutMs Give up after this many milliseconds
 * @returns {Promise<void>}
 */
async function waitForServer(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${base}/api/entry-page`);
            if (res.ok) {
                return;
            }
        } catch (_) {
            // server not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("server did not start in time");
}

/**
 * Emit a socket event and resolve with its callback result.
 * @param {object} socket Socket.IO client
 * @param {string} event Event name
 * @param {...any} args Event arguments
 * @returns {Promise<object>} Callback result
 */
function emit(socket, event, ...args) {
    return new Promise((resolve) => socket.emit(event, ...args, resolve));
}

/**
 * Insert a monitor row directly so the test has something to link.
 * @returns {number} Monitor id
 */
function insertMonitor() {
    const db = new Database(path.join(dataDir, "kuma.db"));
    const owner = db.prepare("SELECT id FROM better_auth_user ORDER BY createdAt").get().id;
    const info = db
        .prepare(
            "INSERT INTO monitor (name, active, user_id, interval, type, hostname, port) VALUES ('integration', 0, ?, 60, 'port', '127.0.0.1', 1)"
        )
        .run(owner);
    db.close();
    return Number(info.lastInsertRowid);
}

/**
 * Read link rows for a maintenance window straight from the database.
 * @param {number} maintenanceID Maintenance id
 * @returns {number[]} Linked monitor ids
 */
function linkedMonitors(maintenanceID) {
    const db = new Database(path.join(dataDir, "kuma.db"), { readonly: true });
    const rows = db.prepare("SELECT monitor_id FROM monitor_maintenance WHERE maintenance_id = ?").all(maintenanceID);
    db.close();
    return rows.map((r) => r.monitor_id);
}

/**
 * Call the maintenance API with the test API key.
 * @param {string} method HTTP method
 * @param {string} url Path below the server root
 * @param {object} body JSON body or undefined
 * @param {boolean} auth Send the API key?
 * @returns {Promise<{status: number, body: object}>} Response
 */
async function call(method, url, body, auth = true) {
    const headers = { "content-type": "application/json" };
    if (auth) {
        headers.authorization = "Basic " + Buffer.from(`x:${apiKey}`).toString("base64");
    }
    const res = await fetch(base + url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = {};
    try {
        parsed = JSON.parse(text);
    } catch (_) {
        // non-JSON error page
    }
    return { status: res.status, body: parsed };
}

before(
    async () => {
        if (!hasDist) {
            return;
        }
        dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kuma-maint-it-")) + path.sep;
        fs.writeFileSync(path.join(dataDir, "db-config.json"), JSON.stringify({ type: "sqlite" }));
        const port = await getFreePort();
        base = `http://127.0.0.1:${port}`;
        serverProcess = spawn("node", ["--import=tsx", "server/server.js"], {
            cwd: repoRoot,
            env: { ...process.env, UPTIME_KUMA_PORT: String(port), DATA_DIR: dataDir },
            stdio: "ignore",
        });
        await waitForServer(120000);

        const setup = await fetch(`${base}/api/setup`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "integration", password: PASSWORD }),
        });
        assert.strictEqual((await setup.json()).ok, true);
        const signIn = await fetch(`${base}/api/auth/sign-in/username`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "integration", password: PASSWORD }),
        });
        assert.strictEqual(signIn.status, 200);
        const cookie = signIn.headers
            .getSetCookie()
            .map((c) => c.split(";")[0])
            .join("; ");

        const socket = io(base, { transports: ["websocket"], extraHeaders: { Cookie: cookie } });
        await new Promise((resolve) => socket.on("connect", resolve));
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const key = await emit(socket, "addAPIKey", { name: "it", expires: null, active: true });
        assert.strictEqual(key.ok, true);
        apiKey = key.key;
        assert.strictEqual((await emit(socket, "setSettings", { apiKeysEnabled: true }, "")).ok, true);
        const sp = await emit(socket, "addStatusPage", "Integration", "integration");
        assert.strictEqual(sp.ok, true);
        socket.close();

        monitorID = insertMonitor();
        statusPageID = 1;
    },
    { timeout: 180000 }
);

after(() => {
    if (serverProcess) {
        serverProcess.kill();
    }
    if (dataDir) {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});

describe("maintenance API against a real server", { skip: hasDist ? false : "dist/ is not built" }, () => {
    test("rejects requests without a valid API key", async () => {
        assert.strictEqual((await call("GET", "/api/maintenance", undefined, false)).status, 401);
        assert.strictEqual((await call("POST", "/api/maintenance/1/resume", undefined, false)).status, 401);
    });

    test("manual window lifecycle with a linked monitor", async () => {
        const created = await call("POST", "/api/maintenance", {
            title: "lifecycle",
            monitorIds: [monitorID],
            statusPageIds: [statusPageID],
        });
        assert.strictEqual(created.status, 201);
        const id = created.body.maintenanceID;
        assert.deepStrictEqual(await linkedMonitors(id), [monitorID]);

        const inactive = await call("GET", `/api/maintenance/${id}`);
        assert.strictEqual(inactive.body.maintenance.status, "inactive");

        assert.strictEqual((await call("POST", `/api/maintenance/${id}/resume`)).status, 200);
        const active = await call("GET", `/api/maintenance/${id}`);
        assert.strictEqual(active.body.maintenance.status, "under-maintenance");

        assert.strictEqual((await call("POST", `/api/maintenance/${id}/pause`)).status, 200);
        assert.strictEqual((await call("GET", `/api/maintenance/${id}`)).body.maintenance.status, "inactive");

        assert.strictEqual((await call("DELETE", `/api/maintenance/${id}`)).status, 200);
        assert.strictEqual((await call("GET", `/api/maintenance/${id}`)).status, 404);
    });

    test("unknown ids and malformed input are rejected with 400/404", async () => {
        assert.strictEqual((await call("POST", "/api/maintenance", { title: "x", monitorIds: [999999] })).status, 400);
        assert.strictEqual(
            (await call("POST", "/api/maintenance", { title: "x", statusPageIds: [999999] })).status,
            400
        );
        assert.strictEqual((await call("POST", "/api/maintenance", { title: "" })).status, 400);
        assert.strictEqual((await call("POST", "/api/maintenance", { title: "x", strategy: "cron" })).status, 400);
        assert.strictEqual((await call("POST", "/api/maintenance/abc/resume")).status, 404);
        assert.strictEqual((await call("DELETE", "/api/maintenance/99999")).status, 404);
    });

    test("invalid timezone is rejected and does not break the list", async () => {
        const bad = await call("POST", "/api/maintenance", { title: "bad tz", timezone: "Not/AZone" });
        assert.strictEqual(bad.status, 400);
        const list = await call("GET", "/api/maintenance");
        assert.strictEqual(list.status, 200);
        assert.ok(!list.body.maintenance.some((m) => m.title === "bad tz"));
    });

    test("single window is scheduled, stores wall-clock time in its timezone, and can be deleted", async () => {
        const created = await call("POST", "/api/maintenance", {
            title: "single",
            strategy: "single",
            active: true,
            timezone: "Europe/Copenhagen",
            start: "2035-01-01T10:00:00Z",
            end: "2035-01-01T11:00:00Z",
        });
        assert.strictEqual(created.status, 201);
        const got = await call("GET", `/api/maintenance/${created.body.maintenanceID}`);
        assert.strictEqual(got.body.maintenance.status, "scheduled");
        assert.deepStrictEqual(got.body.maintenance.dateRange, ["2035-01-01 11:00:00", "2035-01-01 12:00:00"]);
        assert.strictEqual((await call("DELETE", `/api/maintenance/${created.body.maintenanceID}`)).status, 200);
    });

    test("parallel resume and pause calls all succeed", async () => {
        const created = await call("POST", "/api/maintenance", { title: "parallel", monitorIds: [monitorID] });
        const id = created.body.maintenanceID;
        const results = await Promise.all(
            Array.from({ length: 20 }, (_, i) => call("POST", `/api/maintenance/${id}/${i % 2 ? "pause" : "resume"}`))
        );
        assert.ok(results.every((r) => r.status === 200));
        assert.strictEqual((await call("DELETE", `/api/maintenance/${id}`)).status, 200);
    });
});
