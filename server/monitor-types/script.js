const { MonitorType } = require("./monitor-type");
const { UP, PENDING } = require("../../src/util");
const fs = require("fs/promises");
const childProcessAsync = require("promisify-child-process");
const path = require("path");
const { parseArgsStringToArgv } = require("string-argv");
const { log } = require("../../src/util.js");

class SecurityError extends Error {}

/**
 * Helper function that checks if the process has write access to the provided target.
 * On Linux, this function passes off to `fs.access`.
 * On Windows, where `fs.access` does not evaluate ACLs, this function attempts to open the target for writing.
 * If the target is a directory, it will be changed to a new random but unique file inside that directory.
 * @param target
 */
async function writable(target) {
    if (process.platform !== "win32") {
        try {
            await fs.access(target, fs.constants.W_OK);
            return true;
        } catch (err) {
            if (err.code === "EACCES") {
                return false;
            }
            throw err;
        }
    }

    // If target is a directory, generate a unique filename
    // This is accomplished by using the current timestamp in hexadecimal notation.
    // However, using only the timestamp might introduce a race condition if two monitors
    // run closer to each other than the resolution of the system timer:
    // - Monitor 1 opens the probe
    // - Monitor 2 opens the probe
    // - Monitor 1 closes the probe and attempts to delete it, while monitor 2 still has it open
    // This results in an error on Windows.
    //
    // Therefore, a random 2 byte hexadecimal is suffixed to the timestamp.
    let probe;
    if ((await fs.stat(target)).isDirectory()) {
        probe =
            Date.now().toString(16).padStart(16, "0") +
            "-" +
            Math.trunc(Math.random() * 0xffff)
                .toString(16)
                .padStart(4, "0");

        target = path.join(target, probe);
    }

    let handle;
    try {
        handle = await fs.open(target, "w");
        return true;
    } catch (err) {
        // Technically, EACCES is the correct error to throw here
        // However, on Windows, there is a long-standing inconsistency
        // where EPERM is thrown instead
        // (see https://github.com/nodejs/node/issues/16596)
        // We will catch both here in case it ever gets fixed
        if (err.code === "EACCES" || err.code === "EPERM") {
            return false;
        }
        throw err;
    } finally {
        await handle?.close();
        if (probe) {
            await fs.rm(target, { recursive: true, force: true, maxRetries: 3 });
        }
    }
}

class ScriptMonitorType extends MonitorType {
    name = "Custom command";
    type = "script";
    description = "A monitor that executes a script";
    supportsConditions = false;
    conditionVariables = [];

    allowCustomStatus = true;

    /** Maps extensions to their associated interpreters for Windows */
    static EXTENSIONS = {
        /* 
           ".bat": [ "cmd", "/c" ], 
           ".cmd": [ "cmd", "/c" ],
           .bat and .cmd are deliberately disabled because there is no secure way to call them.
           These script formats are interpreted by cmd.exe, and the only way to pass them in is
           by using the /c switch. This however opens up an attack vector through maliciously 
           constructed script names/arguments. Consider e.g. someone forcing the script name
           to "script.bat && format c:", or setting script name to "script.bat" but arguments
           to [ "&& format c:" ].
        */
        ".ps1": [ "powershell", "-File" ],
        ".py":  "python",
        ".js":  "node",
        ".mjs": "node",
        ".cjs": "node",
        ".rb":  "ruby",
        ".vbs": [ "cscript", "//nologo" ],
        ".vbe": [ "cscript", "//nologo" ],
        ".jscript": [ "cscript", "//nologo" ],
        ".jse": [ "cscript", "//nologo" ],
        ".wsf": [ "cscript", "//nologo" ],
        ".wsh": [ "cscript", "//nologo" ]
    }

    /**
     * @param {string} dir path to the scripts directory to execute from
     */
    constructor(dir) {
        super();
        this.dir = dir;
    }

    /**
     * Execute security checks:
     * - script path is inside scripts directory
     * If not running as root (Unixoid) or
     * having privileges SeTakeOwnershipPrivilege, SeRestorePrivilege, or SeImpersonatePrivilege (Windows),
     * also check:
     * - scripts directory is not writable
     * - script file is not writable
     * Returned promise will reject if any security checks fail
     * @param {string} script path to the script intended to be run
     * @returns {Promise<void>}
     */
    async checkSecurity(script) {
        // If requested script is outside of scripts directory, refuse to execute script for security reasons
        const relative = path.relative(this.dir, path.resolve(this.dir, script));
        if (relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
            throw new SecurityError(
                "Script execution has been denied for security reasons: script path is outside script location"
            );
        }

        // Don't care about writability checks if root on Unixoid, or
        // having SeTakeOwnershipPrivilege, SeRestorePrivilege, or SeImpersonatePrivilege on Windows
        if (process.platform !== "win32" && process.getuid() === 0) {
            return;
        }
        if (process.platform === "win32") {
            const { hasEnabledPrivilege, Privilege } = require("win32-privileges");
            if (
                hasEnabledPrivilege(Privilege.SE_TAKE_OWNERSHIP) ||
                hasEnabledPrivilege(Privilege.SE_RESTORE) ||
                hasEnabledPrivilege(Privilege.SE_IMPERSONATE)
            ) {
                return;
            }
        }

        // If scripts directory is writable for current user, refuse to execute script for security reasons
        if (await writable(this.dir)) {
            throw new SecurityError(
                "Script execution has been denied for security reasons: script directory is writable"
            );
        }

        // If requested script is writable for current user, refuse to execute script for security reasons
        if (await writable(path.resolve(this.dir, script))) {
            throw new SecurityError("Script execution has been denied for security reasons: script file is writable");
        }
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat) {
        try {
            await this.checkSecurity(monitor.script);
        } catch (err) {
            if (err instanceof SecurityError) {
                heartbeat.status = PENDING;
                heartbeat.msg = err.message;
                return;
            } else if (err.code === "ENOENT") {
                heartbeat.status = PENDING;
                heartbeat.msg = "Script does not exist: " + monitor.script;
                return;
            } else {
                throw err;
            }
        }

        // Windows doesn't understand hashbangs.
        // So we need to specifically map script extensions to known interpreters
        let command = path.join(this.dir, monitor.script);
        let args = parseArgsStringToArgv(monitor.args ?? "");
        if (process.platform === "win32" && ScriptMonitorType.EXTENSIONS[path.extname(monitor.script)]) {
            let interpreter = ScriptMonitorType.EXTENSIONS[path.extname(monitor.script)];
            if (typeof interpreter === "string") {
                interpreter = [ interpreter ];
            }
            args = [ ...interpreter, command, ...args ];
            command = args.shift();
        }
        try {
            // Security checks completed - run the script
            //
            // Note: spawn() will expose process.env to the child process by default
            // It enables user scripts to access secrets from environment variables.
            // This is safe, because scripts are trusted by design.
            const child = childProcessAsync.spawn(command, args, {
                shell: false, // Security: Prevent command chaining etc.
                detached: true, // Needed so we can reliably kill any subprocesses (grandchildren)
                encoding: "utf8", // Needed to capture stdout & stderr
                timeout: 1000 * monitor.timeout,
                maxBuffer: 1024 * 1024,
                stdio: ["ignore", "pipe", "pipe"],
            });
            const result = await child;
            heartbeat.status = UP;
            heartbeat.msg = result.stdout;
        } catch (err) {
            if (err.stderr) {
                err.message = err.stderr;
            }
            throw err;
        }
    }
}

module.exports = {
    ScriptMonitorType,
};
