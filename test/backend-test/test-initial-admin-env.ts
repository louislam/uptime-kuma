import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataDir = path.join(__dirname, "../../data/test-initial-admin-env");
const username = "envadmin";
const password = "Kuma-Test-8f4Q2xR9p";

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
async function waitForServer(url: string, timeoutMs = 60000) {
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
 * Start a server with the initial admin environment variables.
 * @param {Record<string, string>} env Extra environment variables
 * @returns {Promise<{ child: ChildProcess, baseUrl: string, output: () => string }>} The running server
 */
async function startServer(env: Record<string, string>) {
    const port = await getFreePort();
    const baseEnv = { ...process.env };
    delete baseEnv.UK_INITIAL_ADMIN_USERNAME;
    delete baseEnv.UK_INITIAL_ADMIN_PASSWORD;

    const child = spawn(process.execPath, ["--import=tsx", "server/server.js"], {
        cwd: path.join(__dirname, "../.."),
        env: {
            ...baseEnv,
            DATA_DIR: dataDir,
            UPTIME_KUMA_PORT: String(port),
            UPTIME_KUMA_DB_TYPE: "sqlite",
            UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK: "1",
            ...env,
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let serverOutput = "";
    child.stdout?.on("data", (data) => (serverOutput += data.toString()));
    child.stderr?.on("data", (data) => (serverOutput += data.toString()));

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(`${baseUrl}/api/entry-page`);

    return {
        child,
        baseUrl,
        output: () => serverOutput,
    };
}

/**
 * Stop a server and wait for it to exit.
 * @param {ChildProcess} child Server process
 * @returns {Promise<void>}
 */
async function stopServer(child: ChildProcess) {
    if (child.exitCode !== null) {
        return;
    }

    child.kill();
    await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        child.once("exit", () => {
            clearTimeout(timer);
            resolve(undefined);
        });
    });
}

/**
 * Sign in with a username and password.
 * @param {string} baseUrl Server base URL
 * @param {string} user Username
 * @param {string} pass Password
 * @returns {Promise<Response>} The sign-in response
 */
function login(baseUrl: string, user: string, pass: string) {
    return fetch(`${baseUrl}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
    });
}

test("creates the initial admin from env, then ignores the env on later starts", { timeout: 180000 }, async () => {
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    let child: ChildProcess | null = null;

    try {
        const first = await startServer({
            UK_INITIAL_ADMIN_USERNAME: username,
            UK_INITIAL_ADMIN_PASSWORD: password,
        });
        child = first.child;

        assert.strictEqual((await login(first.baseUrl, username, password)).status, 200);

        await stopServer(child);
        child = null;

        // A changed password in the env must not overwrite the admin created by the first start
        const second = await startServer({
            UK_INITIAL_ADMIN_USERNAME: username,
            UK_INITIAL_ADMIN_PASSWORD: "Different-Test-9x",
        });
        child = second.child;

        assert.strictEqual((await login(second.baseUrl, username, password)).status, 200);
        assert.notStrictEqual((await login(second.baseUrl, username, "Different-Test-9x")).status, 200);
        assert.match(second.output(), /already initialized/);
    } finally {
        if (child) {
            await stopServer(child);
        }
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
});
