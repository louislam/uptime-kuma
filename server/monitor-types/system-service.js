const { MonitorType } = require("./monitor-type");
const { execFile } = require("child_process");
const process = require("process");
const { UP } = require("../../src/util");

class SystemServiceMonitorType extends MonitorType {
    name = "system-service";
    description = "Checks if a system service is running (systemd on Linux, Service Manager on Windows).";

    /**
     * Check the system service status.
     * Detects OS and dispatches to the appropriate check method.
     * @param {object} monitor The monitor object containing monitor.system_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {Promise<void>} Resolves when check is complete.
     */
    async check(monitor, heartbeat) {
        if (!monitor.system_service_name) {
            throw new Error("Service Name is required.");
        }

        if (process.platform === "win32") {
            return this.checkWindows(monitor.system_service_name, heartbeat);
        } else if (process.platform === "linux") {
            return this.checkLinux(monitor.system_service_name, heartbeat);
        } else {
            throw new Error(`System Service monitoring is not supported on ${process.platform}`);
        }
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

            execFile("systemctl", [ "is-active", serviceName ], { timeout: 5000 }, (error, stdout, stderr) => {
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
                throw new Error(
                    "Invalid service name. Only alphanumeric characters and '.', '_', '-' are allowed."
                );
            }

            const cmd = "powershell";
            const args = [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                // Single quotes around the service name
                `(Get-Service -Name '${serviceName.replaceAll("'", "''")}').Status`
            ];

            execFile(cmd, args, { timeout: 5000 }, (error, stdout, stderr) => {
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
