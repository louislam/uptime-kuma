const { MonitorType } = require("./monitor-type");
const { UP, PENDING } = require("../../src/util");
const fs = require("fs/promises");
const childProcessAsync = require("promisify-child-process");
const path = require("path");
const { parseArgsStringToArgv } = require("string-argv");

class SecurityError extends Error {}

class ScriptMonitorType extends MonitorType {
    name = "Custom command";
    type = "script";
    description = "A monitor that executes a script";
    supportsConditions = false;
    conditionVariables = [];

    allowCustomStatus = true;

    /**
     * @param {string} dir path to the scripts directory to execute from
     */
    constructor(dir) {
        super();
        this.dir = dir;
    }

    /**
     * Execute security checks:
     * - not running as root
     * - scripts directory is not writable
     * - script file is not writable
     * - script path is inside scripts directory
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

        // If scripts directory is writable for current user, refuse to execute script for security reasons
        try {
            await fs.access(this.dir, fs.constants.W_OK);
            throw new SecurityError(
                "Script execution has been denied for security reasons: script directory is writable"
            );
        } catch (err) {
            if (err.code !== "EACCES") {
                throw err;
            }
        }

        // If requested script is writable for current user, refuse to execute script for security reasons
        try {
            await fs.access(path.resolve(this.dir, script), fs.constants.W_OK);
            throw new SecurityError("Script execution has been denied for security reasons: script is writable");
        } catch (err) {
            // Customize error message for missing scripts
            if (err.code === "ENOENT") {
                throw new SecurityError("Script does not exist: " + script);
            }
            if (err.code !== "EACCES") {
                throw err;
            }
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
            } else {
                throw err;
            }
        }

        const args = parseArgsStringToArgv(monitor.args ?? "");

        try {
            // Security checks completed - run the script
            //
            // Note: spawn() will expose process.env to the child process by default
            // It enables user scripts to access secrets from environment variables.
            // This is safe, because scripts are trusted by design.
            const child = childProcessAsync.spawn(path.join(this.dir, monitor.script), args, {
                shell: false, // Security: Prevent command chaining etc.
                detached: true, // Needed so we can reliably kill any subprocesses (grandchildren)
                encoding: "utf8", // Needed to capture stdout & stderr
                timeout: 30000,
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
