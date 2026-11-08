const { describe, test } = require("node:test");
const assert = require("node:assert");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { R } = require("redbean-node");

const ROOT = path.join(__dirname, "../..");
const DATA_DIR = "/app/data";
const OLD_PASSWORD = "OldPassword123!";
const NEW_PASSWORD = "NewPassword123!";

// Opt-in only: this test writes to /app/data, which is the real data dir inside the Docker image.
// Run it in a throwaway container: TEST_EMBEDDED_MARIADB=1 node --test test/backend-test/test-reset-password-embedded.js
const available =
    process.env.TEST_EMBEDDED_MARIADB === "1" &&
    process.platform === "linux" &&
    fs.existsSync(DATA_DIR) &&
    childProcess.spawnSync("mariadbd", ["--version"]).status === 0;

describe("Reset password with Embedded MariaDB", { skip: !available }, () => {
    test("attaches to the Embedded MariaDB started by another process", async () => {
        process.env.DATA_DIR = DATA_DIR;
        fs.writeFileSync(path.join(DATA_DIR, "db-config.json"), JSON.stringify({ type: "embedded-mariadb" }));

        const Database = require("../../server/database");
        Database.initDataDir({});
        await Database.connect(false, false, true);

        try {
            await R.exec("INSERT INTO `user` (username, password, active) VALUES (?, ?, 1)", [
                "admin",
                bcrypt.hashSync(OLD_PASSWORD, 10),
            ]);

            const env = { ...process.env, UPTIME_KUMA_PORT: "39999" };
            // TEST_BACKEND disables the CLI entry point, which is set by the test runner
            delete env.TEST_BACKEND;
            const result = childProcess.spawnSync(
                process.execPath,
                ["extra/reset-password.js", "--new-password=" + NEW_PASSWORD],
                {
                    cwd: ROOT,
                    env,
                    encoding: "utf8",
                    timeout: 120000,
                }
            );

            assert.strictEqual(result.status, 0, "reset-password failed:\n" + result.stdout + result.stderr);
            assert.match(result.stdout, /reusing the existing instance/);
            assert.match(result.stdout, /Password reset successfully/);

            const user = await R.getRow("SELECT password FROM `user` WHERE username = ?", ["admin"]);
            assert.ok(await bcrypt.compare(NEW_PASSWORD, user.password));
            assert.ok(!(await bcrypt.compare(OLD_PASSWORD, user.password)));

            // The database must still be running after the CLI tool exits
            assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM `user`"), 1);
        } finally {
            await Database.close();
        }
    });
});
