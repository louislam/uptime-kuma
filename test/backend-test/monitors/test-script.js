const { describe, test } = require("node:test");
const assert = require("node:assert");
const { ScriptMonitorType } = require("../../../server/monitor-types/script");
const { UP, DOWN, PENDING } = require("../../../src/util");
const fs = require("fs/promises");
const path = require("path");
const childProcessAsync = require("promisify-child-process");

describe("Script Monitor", () => {
    const SCRIPT_DIR = "data/scripts";
    const SCRIPT_NAME = "script.sh";

    /**
     * Set up mocks for access rights checking and process spawning
     * @param {TestContext} t Test context to mock in
     * @param {object} options Behavior options for the mocks
     * @returns {void}
     */
    function setup(t, options) {
        options = {
            dirWritable: false,
            scriptWritable: false,
            exitCode: 0,
            stdout: "",
            stderr: "",
            ...options,
        };

        const EACCES = Object.assign(new Error(), { code: "EACCES" });
        const _access = fs.access;

        t.mock.method(fs, "access", async (f, mode) => {
            if (f === SCRIPT_DIR && (mode & fs.constants.W_OK) !== 0) {
                if (options.dirWritable) {
                    return;
                } else {
                    throw EACCES;
                }
            }
            if (f === path.resolve(SCRIPT_DIR, SCRIPT_NAME)) {
                if (options.scriptWritable) {
                    return;
                } else {
                    throw EACCES;
                }
            }

            return _access(f, mode);
        });
        t.mock.method(childProcessAsync, "spawn", () => {
            const result = {
                code: options.exitCode,
                stdout: options.stdout,
                stderr: options.stderr,
            };
            if (options.exitCode === 0) {
                return Promise.resolve(result);
            } else {
                return Promise.reject(result);
            }
        });
    }

    test("check() sets status to PENDING when script path is outside scripts directory", async (t) => {
        setup(t);

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: "/absolute/path/script.sh" };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(
            heartbeat.msg,
            "Script execution has been denied for security reasons: script path is outside script location"
        );
    });

    test("check() sets status to PENDING when scripts directory is writable", async (t) => {
        setup(t, { dirWritable: true });

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: SCRIPT_NAME };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(
            heartbeat.msg,
            "Script execution has been denied for security reasons: script directory is writable"
        );
    });

    test("check() sets status to PENDING when script file is writable", async (t) => {
        setup(t, { scriptWritable: true });

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: SCRIPT_NAME };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(heartbeat.msg, "Script execution has been denied for security reasons: script is writable");
    });

    test("check() does not care about writability when root (uid===0) in Unix-like", async (t) => {
        if (process.platform.toLowerCase() === "win32") {
            t.skip("This test is only run on aix, darwin, freebsd, linux, openbsd, or sunos");
            return;
        }

        setup(t, { dirWritable: true, scriptWritable: true });

        const method = t.mock.method(process, "getuid", () => 0);
        try {
            const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
            const monitor = { script: SCRIPT_NAME };
            const heartbeat = { status: null, msg: "" };

            await scriptMonitor.check(monitor, heartbeat, {});

            assert.notStrictEqual(heartbeat.status, PENDING);
        } finally {
            method.mock.restore();
        }
    });

    test("check() does not care about writability when SeTakeOwnershipPrivilege, SeRestorePrivilege, or SeImpersonatePrivilege are present in Windows", async (t) => {
        if (process.platform.toLowerCase() !== "win32") {
            t.skip("This test is only run on win32");
            return;
        }

        setup(t, { dirWritable: true, scriptWritable: true });
        
        const privilegeModule = require("win32-privileges");
        const Privilege = privilegeModule.Privilege;
        const RELEVANT_PRIVILEGES = [
            Privilege.SE_TAKE_OWNERSHIP,
            Privilege.SE_RESTORE,
            Privilege.SE_IMPERSONATE,
        ];

        for (const privilege of RELEVANT_PRIVILEGES) {
            const method = t.mock.method(privilegeModule, "hasEnabledPrivilege", (priv) => priv === privilege);
            try {
                const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
                const monitor = { script: SCRIPT_NAME };
                const heartbeat = { status: null, msg: "" };

                await scriptMonitor.check(monitor, heartbeat, {});

                assert.notStrictEqual(heartbeat.status, PENDING);
            } finally {
                method.mock.restore();
            }
        }
    });

    test("check() sets status to PENDING when script does not exist", async (t) => {
        setup(t);

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: "does_not_exist.sh" };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, PENDING);
        assert.strictEqual(heartbeat.msg, "Script does not exist: does_not_exist.sh");
    });

    test("check() calls the specified script with the specified args", async (t) => {
        setup(t, {});
        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);

        const monitor = { script: SCRIPT_NAME, args: "--arg1 --arg2 foo --arg3=bar" };
        const heartbeat = { status: null, msg: "" };
        await scriptMonitor.check(monitor, heartbeat, {});

        const spawnMock = childProcessAsync.spawn.mock;
        assert.strictEqual(spawnMock.callCount(), 1);
        assert.strictEqual(spawnMock.calls[0].arguments[0], path.join(SCRIPT_DIR, monitor.script));
        assert.deepEqual(spawnMock.calls[0].arguments[1], monitor.args.split(" "));
    });

    test("check() executes the target script without a shell (security)", async (t) => {
        setup(t, {});
        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);

        const monitor = { script: SCRIPT_NAME };
        const heartbeat = { status: null, msg: "" };
        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(childProcessAsync.spawn.mock.callCount(), 1);
        assert(
            !childProcessAsync.spawn.mock.calls[0].arguments[2].shell,
            "Scripts execute with shell: true.\n\n\nTHIS IS A SEVERE SECURITY RISK!\n\n\n"
        );
    });

    test("check() sets status to UP when script exits with exit code 0", async (t) => {
        const stdout = "Success";
        setup(t, { stdout });

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: SCRIPT_NAME };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, stdout);
    });

    test("check() rejects when script exits with exit code other than 0", async (t) => {
        const stderr = "Failure";
        setup(t, { exitCode: 1, stderr });

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: SCRIPT_NAME, args: [] };
        const heartbeat = { status: null, msg: "" };

        await assert.rejects(scriptMonitor.check(monitor, heartbeat, {}), (err) => err.message === stderr);
    });
});
