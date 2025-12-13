const { MonitorType } = require("./monitor-type");
const { execFile } = require("child_process");
const { DOWN, UP } = require("../../src/util");

class LocalServiceMonitorType extends MonitorType {
    name = "local-service";
    description = "Checks if a local service is running by executing a command.";

    /**
     * Check a local systemd service status.
     * Uses `systemctl is-running` to determine if the service is active.
     * @param {object} monitor The monitor object containing serviceName.
     * @param {object} heartbeat The heartbeat object to update.
     * @param {object} server The server object (unused in this specific check).
     * @returns {Promise<object>} A promise that resolves with the updated heartbeat.
     * @throws {Error} If the serviceName is invalid or the command execution fails.
     */
    async check(monitor, heartbeat, server) {
        // This is the name of the service to check e.g. "nginx.service"
        const serviceName = monitor.local_service_name;

        // Basic sanitization to prevent argument injection.
        // This regex allows for standard service names, including those with instances like "sshd@.service".
        if (!serviceName || !/^[a-zA-Z0-9._\-@]+$/.test(serviceName)) {
            heartbeat.status = DOWN;
            heartbeat.msg = "Invalid service name provided.";
            throw new Error(heartbeat.msg);
        }

        return new Promise((resolve, reject) => {
            execFile("systemctl", [ "is-active", serviceName ], (error, stdout, stderr) => {
                // systemctl is-active exits with 0 if the service is active,
                // and a non-zero code if it is inactive, failed, or not found.
                if (error) {
                    heartbeat.status = DOWN;
                    // stderr often contains useful info like "service not found"
                    heartbeat.msg = stderr || stdout || `Service '${serviceName}' is not running.`;
                    reject(new Error(heartbeat.msg));
                    return;
                }

                // If there's no error, the service is running.
                heartbeat.status = UP;
                heartbeat.msg = `Service '${serviceName}' is running.`;
                resolve(heartbeat);
            });
        });
    }
}

module.exports = {
    LocalServiceMonitorType,
};
