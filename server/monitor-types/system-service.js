const { MonitorType } = require("./monitor-type");
const { execFile } = require("child_process");
const process = require("process");
const { DOWN, UP } = require("../../src/util");

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
        // Use the new variable name 'system_service_name' to match the monitor type change
        const serviceName = monitor.system_service_name;

        // Basic sanitization.
        // We do not allow spaces to ensure users use the "Service Name" (wuauserv) and not "Display Name".
        if (!serviceName || !/^[a-zA-Z0-9._\-@]+$/.test(serviceName)) {
            heartbeat.status = DOWN;
            heartbeat.msg = "Invalid service name. Please use the internal Service Name (no spaces).";
            throw new Error(heartbeat.msg);
        }

        if (process.platform === "win32") {
            return this.checkWindows(serviceName, heartbeat);
        } else {
            return this.checkLinux(serviceName, heartbeat);
        }
    }

    /**
     * Linux Check (Systemd)
     * @param {string} serviceName The name of the service to check.
     * @param {object} heartbeat The heartbeat object.
     * @returns {Promise<void>} Resolves on success, rejects on error.
     */
    async checkLinux(serviceName, heartbeat) {
        return new Promise((resolve, reject) => {
            // Linter requires spaces inside array brackets: [ "arg1", "arg2" ]
            execFile("systemctl", [ "is-active", serviceName ], (error, stdout, stderr) => {
                // Combine output and truncate to ~200 chars to prevent DB bloat
                let output = (stderr || stdout || "").toString().trim();
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                if (error) {
                    heartbeat.msg = output || `Service '${serviceName}' is not running.`;
                    reject(new Error(heartbeat.msg));
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
            const cmd = "powershell";
            // -NoProfile: Faster startup, -NonInteractive: No prompts
            const args = [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `(Get-Service -Name "${serviceName}").Status`
            ];

            execFile(cmd, args, (error, stdout, stderr) => {
                let output = (stderr || stdout || "").toString().trim();
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                // PowerShell writes to stderr if the service is not found
                if (error || stderr) {
                    heartbeat.msg = output || `Service '${serviceName}' is not running/found.`;
                    reject(new Error(heartbeat.msg));
                    return;
                }

                if (output === "Running") {
                    heartbeat.status = UP;
                    heartbeat.msg = `Service '${serviceName}' is running.`;
                    resolve();
                } else {
                    heartbeat.msg = `Service '${serviceName}' is ${output}.`;
                    reject(new Error(heartbeat.msg));
                }
            });
        });
    }
}

module.exports = {
    SystemServiceMonitorType,
};
