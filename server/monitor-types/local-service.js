const { MonitorType } = require("./monitor-type");
const { execFile } = require("child_process");
const { DOWN, UP } = require("../../src/util");

class LocalServiceMonitorType extends MonitorType {
    name = "local-service";
    description = "Checks if a local service is running by executing a command.";

    /**
     * Check a local systemd service status.
     * Uses `systemctl is-running` to determine if the service is active.
     * @param {object} monitor The monitor object containing monitor.local_service_name.
     * @param {object} heartbeat The heartbeat object to update.
     * @param {object} server The server object (unused in this specific check).
     * @returns {Promise<object>} A promise that resolves with the updated heartbeat.
     * @throws {Error} If the monitor.local_service_name is invalid or the command execution fails.
     */
    async check(monitor, heartbeat, server) {
        // Basic sanitization to prevent argument injection.
        // This regex allows for standard service names, including those with instances like "sshd@.service".
        if (!monitor.local_service_name || !/^[a-zA-Z0-9._\-@]+$/.test(monitor.local_service_name)) {
            heartbeat.status = DOWN;
            heartbeat.msg = "Invalid service name provided.";
            throw new Error(heartbeat.msg);
        }

        return new Promise((resolve, reject) => {
            execFile("systemctl", [ "is-active", monitor.local_service_name ], (error, stdout, stderr) => {
                // systemctl is-active exits with 0 if the service is active,
                // and a non-zero code if it is inactive, failed, or not found.
                // 1. Capture the raw output (prioritize stderr for errors)
                let output = (stderr || stdout || "").toString().trim();

                // 2. Truncate if too long to ~200 chars
                if (output.length > 200) {
                    output = output.substring(0, 200) + "...";
                }

                if (error) {
                    // stderr often contains useful info like "service not found"
                    // Use the truncated output, or a default fallback if empty
                    heartbeat.msg = stderr || stdout || `Service '${monitor.local_service_name}' is not running.`;
                    reject(new Error(heartbeat.msg));
                    return;
                }

                // If there's no error, the service is running.
                heartbeat.status = UP;
                heartbeat.msg = `Service '${monitor.local_service_name}' is running.`;
                resolve();
            });
        });
    }
}

module.exports = {
    LocalServiceMonitorType,
};
