const { describe, test } = require("node:test");
const assert = require("node:assert");
const { execAsync, execFileAsync } = require("../../server/util");

describe("Child process helpers", () => {
    test("execFileAsync() runs a real process and resolves with its stdout", async () => {
        const { stdout, stderr } = await execFileAsync(process.execPath, ["-e", "console.log('ok')"], {
            encoding: "utf8",
        });

        assert.strictEqual(stdout, "ok\n");
        assert.strictEqual(stderr, "");
    });

    test("execFileAsync() rejects with the exit code of a failing process", async () => {
        await assert.rejects(
            () => execFileAsync(process.execPath, ["-e", "process.exit(3)"], { encoding: "utf8" }),
            (error) => error.code === 3
        );
    });

    test("execAsync() runs a real process through the shell", async () => {
        const { stdout } = await execAsync(`"${process.execPath}" -e "console.log('sha')"`, { encoding: "utf8" });

        assert.strictEqual(stdout, "sha\n");
    });
});
