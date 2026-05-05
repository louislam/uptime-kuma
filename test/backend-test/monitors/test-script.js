const { describe, test } = require("node:test");
const assert = require("node:assert");
const { ScriptMonitorType } = require("../../../server/monitor-types/script");
const { UP, PENDING } = require("../../../src/util");
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
            uid: 1000,
            privileges: [],
            exitCode: 0,
            stdout: "",
            stderr: "",
            ...options,
        };

        const EACCES = Object.assign(new Error(), { code: "EACCES" });
        const EPERM = Object.assign(new Error(), { code: "EPERM" });
        const _access = fs.access;
        const _open = fs.open;
        const _stat = fs.stat;
        const _rm = fs.rm;

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
        t.mock.method(fs, "stat", async (f) => {
            switch (f) {
                case SCRIPT_DIR:
                    return {
                        isDirectory() {
                            return true;
                        },
                    };
                case path.resolve(SCRIPT_DIR, SCRIPT_NAME):
                    return {
                        isDirectory() {
                            return false;
                        },
                    };
                default:
                    return _stat(f);
            }
        });
        t.mock.method(fs, "open", async (f, flags, mode) => {
            if (
                path.relative(path.dirname(f), SCRIPT_DIR) === "" &&
                path.basename(f).match(/^[a-f0-9]{16}-[a-f0-9]{4}$/i) &&
                flags.includes("w")
            ) {
                if (options.dirWritable) {
                    return { async close() {} };
                } else {
                    throw EPERM;
                }
            }
            if (path.relative(f, path.resolve(SCRIPT_DIR, SCRIPT_NAME)) === "" && flags.includes("w")) {
                if (options.scriptWritable) {
                    return { async close() {} };
                } else {
                    throw EPERM;
                }
            }

            return _open(f, mode);
        });
        t.mock.method(fs, "rm", async (f, options) => {
            if (f === SCRIPT_DIR || f === path.resolve(SCRIPT_DIR, SCRIPT_NAME)) {
                return;
            }
            return _rm(f, options);
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
        if (process.platform === "win32") {
            const mdl = require("win32-privileges");
            t.mock.method(mdl, "hasEnabledPrivilege", (priv) => options.privileges.includes(priv));
        } else {
            t.mock.method(process, "getuid", () => options.uid);
        }
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
        assert.strictEqual(
            heartbeat.msg,
            "Script execution has been denied for security reasons: script file is writable"
        );
    });

    test("check() does not care about writability when root (uid===0) in Unix-like", async (t) => {
        if (process.platform.toLowerCase() === "win32") {
            t.skip("This test is only run on aix, darwin, freebsd, linux, openbsd, or sunos");
            return;
        }

        setup(t, { dirWritable: true, scriptWritable: true, uid: 0 });

        const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
        const monitor = { script: SCRIPT_NAME };
        const heartbeat = { status: null, msg: "" };

        await scriptMonitor.check(monitor, heartbeat, {});

        assert.notStrictEqual(heartbeat.status, PENDING);
    });

    test("check() does not care about writability when SeTakeOwnershipPrivilege, SeRestorePrivilege, or SeImpersonatePrivilege are present in Windows", async (t) => {
        if (process.platform.toLowerCase() !== "win32") {
            t.skip("This test is only run on win32");
            return;
        }

        const { Privilege } = require("win32-privileges");
        const RELEVANT_PRIVILEGES = [Privilege.SE_TAKE_OWNERSHIP, Privilege.SE_RESTORE, Privilege.SE_IMPERSONATE];

        for (const privilege of RELEVANT_PRIVILEGES) {
            setup(t, { dirWritable: true, scriptWritable: true, privileges: [privilege] });

            const scriptMonitor = new ScriptMonitorType(SCRIPT_DIR);
            const monitor = { script: SCRIPT_NAME };
            const heartbeat = { status: null, msg: "" };

            await scriptMonitor.check(monitor, heartbeat, {});

            assert.notStrictEqual(heartbeat.status, PENDING);
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
