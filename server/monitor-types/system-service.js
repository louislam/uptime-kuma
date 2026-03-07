const { MonitorType } = require("./monitor-type");
const { execFile } = require("child_process");
const process = require("process");
const { UP } = require("../../src/util");

class SystemServiceMonitorType extends MonitorType {
    name = "system-service";
    description = "Checks if a system service is running (systemd on Linux, Service Manager on Windows) or a PM2 process.";

    constructor() {
        super();
        this.execFile = execFile;
    }

    /**
     * Check the system service status.
     * Detects OS and dispatches to the appropriate check method.
     * @param {object} monitor The monitor object containing monitor.system_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>} Resolves when check is complete.
     */
    async check(monitor, heartbeat) {
        const target = this.parseTarget(monitor.system_service_name);

        if (!target.name) {
            throw new Error("Service Name is required.");
        }

        if (target.mode === "pm2") {
            return this.checkPM2(target.name, heartbeat);
        }

        if (target.platform === "win32") {
            if (process.platform !== "win32") {
                throw new Error("Selected platform Windows Server is not supported on this host.");
            }
            return this.checkWindows(target.name, heartbeat);
        } else if (target.platform === "linux") {
            if (process.platform !== "linux") {
                throw new Error("Selected platform Linux is not supported on this host.");
            }
            return this.checkLinux(target.name, heartbeat);
        } else {
            throw new Error(`System Service monitoring is not supported on ${target.platform}`);
        }
    }

    /**
     * Parse encoded monitor target.
     * Supported formats:
     *  - pm2:<processNameOrId>
     *  - svc:<platform>:<serviceName> where platform is linux|win32
     *  - <serviceName> (legacy; platform inferred from current host)
     * @param {string} raw Raw monitor.system_service_name.
     * @returns {{mode: "service" | "pm2", platform: string, name: string}}
     */
    parseTarget(raw) {
        const value = (raw || "").trim();

        if (!value) {
            return {
                mode: "service",
                platform: process.platform,
                name: "",
            };
        }

        if (value.toLowerCase().startsWith("pm2:")) {
            return {
                mode: "pm2",
                platform: process.platform,
                name: value.slice(4).trim(),
            };
        }

        const serviceWithPlatform = value.match(/^svc:(linux|win32):([\s\S]+)$/i);
        if (serviceWithPlatform) {
            return {
                mode: "service",
                platform: serviceWithPlatform[1].toLowerCase(),
                name: serviceWithPlatform[2].trim(),
            };
        }

        return {
            mode: "service",
            platform: process.platform,
            name: value,
        };
    }

    /**
     * PM2 process check
     * @param {string} processName PM2 process name or numeric id (after pm2: prefix).
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>}
     */
    async checkPM2(processName, heartbeat) {
        return new Promise((resolve, reject) => {
            if (!processName || /[\u0000-\u001F\u007F]/.test(processName)) {
                reject(new Error("Invalid PM2 process name."));
                return;
            }

            const isWindows = process.platform === "win32";
            const command = isWindows ? (process.env.ComSpec || "cmd.exe") : "pm2";
            const args = isWindows ? ["/d", "/s", "/c", "pm2 jlist"] : ["jlist"];

            this.execFile(command, args, { timeout: 5000 }, (error, stdout, stderr) => {
                if (error) {
                    let output = (stderr || "").toString().trim();
                    if (output.length > 200) {
                        output = output.substring(0, 200) + "...";
                    }
                    const details = output || error.code || error.message;
                    reject(new Error(`Unable to query PM2 status (${details}). Ensure PM2 is installed and accessible.`));
                    return;
                }

                let processList;
                try {
                    processList = JSON.parse((stdout || "").toString());
                } catch (parseError) {
                    reject(new Error("Unable to parse PM2 status output."));
                    return;
                }

                if (!Array.isArray(processList)) {
                    reject(new Error("Unexpected PM2 status output."));
                    return;
                }

                const entry = processList.find((item) => {
                    if (!item || typeof item !== "object") {
                        return false;
                    }
                    const itemName = item.name;
                    const itemId = item.pm_id;
                    return itemName === processName || String(itemId) === processName;
                });

                if (!entry) {
                    reject(new Error(`PM2 process '${processName}' was not found.`));
                    return;
                }

                const status = entry.pm2_env?.status?.toString().toLowerCase() || "unknown";

                if (status === "online") {
                    heartbeat.status = UP;
                    heartbeat.msg = `PM2 process '${processName}' is online.`;
                    resolve();
                    return;
                }

                // Explicitly map stopped/errored states to down status.
                if (status === "stopped" || status === "errored") {
                    reject(new Error(`PM2 process '${processName}' is ${status}.`));
                    return;
                }

                let output = (stderr || "").toString().trim();
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                reject(new Error(output || `PM2 process '${processName}' is ${status}.`));
            });
        });
    }

    /**
     * Linux Check (Systemd)
     * @param {string} serviceName The name of the service to check.
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>}
     */
    async checkLinux(serviceName, heartbeat) {
        return new Promise((resolve, reject) => {
            // SECURITY: Prevent Argument Injection
            // Only allow alphanumeric, dots, dashes, underscores, and @
            if (!serviceName || !/^[a-zA-Z0-9._\-@]+$/.test(serviceName)) {
                reject(new Error("Invalid service name. Please use the internal Service Name (no spaces)."));
                return;
            }

            this.execFile("systemctl", ["is-active", serviceName], { timeout: 5000 }, (error, stdout, stderr) => {
                // Combine output and truncate to ~200 chars to prevent DB bloat
                let output = (stderr || stdout || "").toString().trim();
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                if (error) {
                    reject(new Error(output || `Service '${serviceName}' is not running.`));
                    return;
                }

                heartbeat.status = UP;
                heartbeat.msg = `Service '${serviceName}' is running.`;
                resolve();
            });
        });
    }

    /**
     * Windows Check (PowerShell)
     * @param {string} serviceName The name of the service to check.
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>} Resolves on success, rejects on error.
     */
    async checkWindows(serviceName, heartbeat) {
        return new Promise((resolve, reject) => {
            // SECURITY: Validate service name to reduce command-injection risk
            if (!/^[A-Za-z0-9._-]+$/.test(serviceName)) {
                throw new Error("Invalid service name. Only alphanumeric characters and '.', '_', '-' are allowed.");
            }

            const cmd = "powershell";
            const args = [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                // Single quotes around the service name
                `(Get-Service -Name '${serviceName.replaceAll("'", "''")}').Status`,
            ];

            this.execFile(cmd, args, { timeout: 5000 }, (error, stdout, stderr) => {
                let output = (stderr || stdout || "").toString().trim();
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                if (error || stderr) {
                    reject(new Error(`Service '${serviceName}' is not running/found.`));
                    return;
                }

                if (output === "Running") {
                    heartbeat.status = UP;
                    heartbeat.msg = `Service '${serviceName}' is running.`;
                    resolve();
                } else {
                    reject(new Error(`Service '${serviceName}' is ${output}.`));
                }
            });
        });
    }
}

module.exports = {
    SystemServiceMonitorType,
};
