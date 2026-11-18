import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");

const username = "offlineadmin";
const password = "Kuma-Test-8f4Q2xR9p";
const newPassword = "Kuma-Test-7h2Lm4Wq8";

// Every outbound request fails, as on a pod without egress
const offlineEnv = {
    NODE_USE_ENV_PROXY: "1",
    HTTP_PROXY: "http://127.0.0.1:1",
    HTTPS_PROXY: "http://127.0.0.1:1",
};

/**
 * Get a free TCP port from the OS.
 * @returns {Promise<number>} A free port
 */
function getFreePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as net.AddressInfo;
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
        } catch {
            // Not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

/**
 * Start a server whose outbound requests all fail.
 * @param {string} dataDir Data directory of the instance
 * @returns {Promise<{ child: ChildProcess, baseUrl: string, output: () => string }>} The running server
 */
async function startOfflineServer(dataDir: string) {
    const port = await getFreePort();
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.UK_INITIAL_ADMIN_USERNAME;
    delete env.UK_INITIAL_ADMIN_PASSWORD;
    delete env.UPTIME_KUMA_DISABLE_LEAK_PWD_CHECK;

    const child = spawn(process.execPath, ["--import=tsx", "server/server.js"], {
        cwd: ROOT,
        env: {
            ...env,
            ...offlineEnv,
            DATA_DIR: dataDir,
            UPTIME_KUMA_PORT: String(port),
            UPTIME_KUMA_DB_TYPE: "sqlite",
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
 * Start a server, create the first admin through the setup API and stop it again.
 * @param {string} dataDir Data directory of the instance
 * @returns {Promise<void>}
 */
async function createAdminOffline(dataDir: string) {
    const server = await startOfflineServer(dataDir);

    try {
        const res = await fetch(`${server.baseUrl}/api/setup`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        assert.deepStrictEqual(await res.json(), { ok: true }, server.output());
    } finally {
        await stopServer(server.child);
    }
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

/**
 * Read the cookie header from a response.
 * @param {Response} res Response with Set-Cookie headers
 * @returns {string} Cookie header value
 */
function cookieHeader(res: Response) {
    return res.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
}

test(
    "setup and password change work when the leaked-password service is unreachable",
    { timeout: 180000 },
    async () => {
        const dataDir = "./data/test-setup-offline";
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

        let child: ChildProcess | null = null;

        try {
            const server = await startOfflineServer(dataDir);
            child = server.child;

            // First admin setup must not be blocked by the unreachable check
            const setupRes = await fetch(`${server.baseUrl}/api/setup`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            assert.deepStrictEqual(await setupRes.json(), { ok: true }, server.output());

            const signInRes = await login(server.baseUrl, username, password);
            assert.strictEqual(signInRes.status, 200, server.output());

            // Changing the password in Settings must work too
            const changeRes = await fetch(`${server.baseUrl}/api/auth/change-password`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    origin: "http://localhost:3000",
                    cookie: cookieHeader(signInRes),
                },
                body: JSON.stringify({ currentPassword: password, newPassword, revokeOtherSessions: false }),
            });
            assert.strictEqual(changeRes.status, 200, await changeRes.text());

            assert.strictEqual((await login(server.baseUrl, username, newPassword)).status, 200, server.output());
            assert.notStrictEqual((await login(server.baseUrl, username, password)).status, 200);
        } finally {
            if (child) {
                await stopServer(child);
            }
            fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
        }
    }
);

test("the reset-password tool works when the leaked-password service is unreachable", { timeout: 180000 }, async () => {
    const dataDir = "./data/test-reset-password-offline";
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });

    let child: ChildProcess | null = null;

    try {
        await createAdminOffline(dataDir);

        const env: NodeJS.ProcessEnv = {
            ...process.env,
            ...offlineEnv,
            DATA_DIR: dataDir,
            UPTIME_KUMA_PORT: "39998",
        };
        // TEST_BACKEND disables the CLI entry point, which is set by the test runner
        delete env.TEST_BACKEND;

        const result = spawnSync(
            process.execPath,
            ["--import=tsx", "extra/reset-password.mts", "--new-password=" + newPassword],
            {
                cwd: ROOT,
                env,
                encoding: "utf8",
                timeout: 120000,
            }
        );

        assert.strictEqual(result.status, 0, "reset-password failed:\n" + result.stdout + result.stderr);

        const server = await startOfflineServer(dataDir);
        child = server.child;

        assert.strictEqual((await login(server.baseUrl, username, newPassword)).status, 200, server.output());
        assert.notStrictEqual((await login(server.baseUrl, username, password)).status, 200);
    } finally {
        if (child) {
            await stopServer(child);
        }
        fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
});
