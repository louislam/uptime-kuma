const { describe, test } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { R } = require("redbean-node");
const { MySqlContainer } = require("@testcontainers/mysql");

const ROOT = path.join(__dirname, "../..");
const OLD_PASSWORD = "OldPassword123!";
const NEW_PASSWORD = "NewPassword123!";
const SKIP_MYSQL = !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64");

/**
 * Create a temporary data directory with db-config.json
 * @param {object} dbConfig Database config
 * @returns {string} The data directory
 */
function createDataDir(dbConfig) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kuma-reset-password-"));
    fs.writeFileSync(path.join(dataDir, "db-config.json"), JSON.stringify(dbConfig, null, 4));
    return dataDir;
}

/**
 * Open a SQLite connection to the test database
 * @param {string} dataDir Data directory
 * @returns {import("knex").Knex} Knex instance
 */
function openSQLite(dataDir) {
    const Dialect = require("knex/lib/dialects/sqlite3/index.js");
    Dialect.prototype._driver = () => require("@louislam/sqlite3");
    return require("knex")({
        client: Dialect,
        connection: { filename: path.join(dataDir, "kuma.db") },
        useNullAsDefault: true,
    });
}

/**
 * Run the reset-password CLI tool
 * @param {string} dataDir Data directory
 * @returns {import("node:child_process").SpawnSyncReturns<string>} Result
 */
function runResetPassword(dataDir) {
    const env = { ...process.env, DATA_DIR: dataDir, UPTIME_KUMA_PORT: "39999" };
    // TEST_BACKEND disables the CLI entry point, which is set by the test runner
    delete env.TEST_BACKEND;
    return childProcess.spawnSync(process.execPath, ["extra/reset-password.js", "--new-password=" + NEW_PASSWORD], {
        cwd: ROOT,
        env,
        encoding: "utf8",
        timeout: 120000,
    });
}

/**
 * Assert the CLI tool reset the password successfully
 * @param {import("node:child_process").SpawnSyncReturns<string>} result Result
 * @returns {void}
 */
function assertResetSucceeded(result) {
    assert.strictEqual(result.status, 0, "reset-password failed:\n" + result.stdout + result.stderr);
    assert.match(result.stdout, /Password reset successfully/);
}

/**
 * Assert the stored password hash matches the new password
 * @param {string} hash Stored hash
 * @returns {Promise<void>}
 */
async function assertNewPassword(hash) {
    assert.ok(await bcrypt.compare(NEW_PASSWORD, hash), "The new password should match the stored hash");
    assert.ok(!(await bcrypt.compare(OLD_PASSWORD, hash)), "The old password should no longer work");
}

describe("Reset password", () => {
    test("resets the password on SQLite", async () => {
        const dataDir = createDataDir({ type: "sqlite" });
        fs.copyFileSync(path.join(ROOT, "db/kuma.db"), path.join(dataDir, "kuma.db"));

        let db = openSQLite(dataDir);
        try {
            await db("user").insert({
                username: "admin",
                password: bcrypt.hashSync(OLD_PASSWORD, 10),
                active: 1,
            });
        } finally {
            await db.destroy();
        }

        try {
            assertResetSucceeded(runResetPassword(dataDir));

            db = openSQLite(dataDir);
            try {
                const user = await db("user").where({ username: "admin" }).first();
                await assertNewPassword(user.password);
            } finally {
                await db.destroy();
            }
        } finally {
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    });

    test("resets the password on external MySQL", { skip: SKIP_MYSQL }, async () => {
        const container = await new MySqlContainer("mysql:8.0")
            .withDatabase("kuma")
            .withUsername("kuma")
            .withUserPassword("kuma")
            .withRootPassword("root")
            .withStartupTimeout(120000)
            .start();

        const dataDir = createDataDir({
            type: "mariadb",
            hostname: container.getHost(),
            port: container.getPort(),
            username: "root",
            password: "root",
            dbName: "kuma",
        });

        const db = require("knex")({
            client: "mysql2",
            connection: {
                host: container.getHost(),
                port: container.getPort(),
                user: "root",
                password: "root",
                database: "kuma",
                timezone: "Z",
            },
            pool: { min: 0, max: 10 },
        });

        try {
            R.setup(db);
            const { createTables } = require("../../db/knex_init_db");
            await createTables();
            await R.knex.migrate.latest({ directory: path.join(ROOT, "db/knex_migrations") });
            await R.exec("INSERT INTO `user` (username, password, active) VALUES (?, ?, 1)", [
                "admin",
                bcrypt.hashSync(OLD_PASSWORD, 10),
            ]);

            assertResetSucceeded(runResetPassword(dataDir));

            const user = await R.getRow("SELECT password FROM `user` WHERE username = ?", ["admin"]);
            await assertNewPassword(user.password);

            // The container must still be usable after the CLI tool exits
            assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM `user`"), 1);
        } finally {
            try {
                await db.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
            try {
                await container.stop();
            } catch (e) {
                // Ignore cleanup errors
            }
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    });
});
