const { describe, test } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const path = require("node:path");
const { auth, checkPassword } = require("../../server/better-auth");
const TestDB = require("../mock-testdb");

const ROOT = path.join(__dirname, "../..");
const DATA_DIR = "./data/test-reset-password";
const OLD_PASSWORD = "OldPassword123!";
const NEW_PASSWORD = "NewPassword123!";

/**
 * Run the reset-password CLI tool against the test data directory
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Result
 */
function runResetPassword() {
    const env = { ...process.env, DATA_DIR };
    // TEST_BACKEND disables the CLI entry point, which is set by the test runner
    delete env.TEST_BACKEND;

    return childProcess.spawnSync(
        process.execPath,
        ["--import=tsx", "extra/reset-password.mts", "--new-password=" + NEW_PASSWORD],
        {
            cwd: ROOT,
            env,
            encoding: "utf8",
            timeout: 120000,
        }
    );
}

describe("Reset password", () => {
    test("resets the password on SQLite", async () => {
        const testDb = new TestDB(DATA_DIR);
        await testDb.create();

        try {
            await auth().api.createUser({
                body: {
                    name: "admin",
                    email: "admin@noreply.uptime-kuma.internal",
                    password: OLD_PASSWORD,
                    role: "admin",
                    data: {
                        username: "admin",
                    },
                },
            });

            assert.strictEqual(await checkPassword("admin", OLD_PASSWORD), true);

            const result = runResetPassword();
            assert.strictEqual(result.status, 0, "reset-password failed:\n" + result.stdout + result.stderr);
            assert.match(result.stdout, /Password reset successfully/);

            assert.strictEqual(await checkPassword("admin", NEW_PASSWORD), true);
            assert.strictEqual(await checkPassword("admin", OLD_PASSWORD), false);
        } finally {
            await testDb.destroy();
        }
    });
});
