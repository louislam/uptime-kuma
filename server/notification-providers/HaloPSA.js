const NotificationProvider = require("./notification-provider");
const axios = require("axios");

/**
 * Halo PSA notification provider implementation
 */
class HaloPSA extends NotificationProvider {
    /**
     * Provider name used in registration
     * @type {string}
     */
    name = "HaloPSA";

    /**
     * Send notification to Halo PSA webhook
     * @param {object} notification - Notification configuration
     * @param {string} msg - Message content
     * @param {object|null} monitorJSON - Monitor configuration (null for cert expiry)
     * @param {object|null} heartbeatJSON - Heartbeat data
     * @returns {Promise<string>} Success message
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent successfully.";

        try {
            // Determine status based on heartbeat
            let status = "UNKNOWN";
            if (heartbeatJSON?.status === 1) {
                status = "UP";
            } else if (heartbeatJSON?.status === 0) {
                status = "DOWN";
            } else if (monitorJSON == null && heartbeatJSON != null) {
                status = "NOTIFICATION";
            }

            /**
             * Payload structure expected by Halo PSA webhook
             * @type {object}
             */
            const payload = {
                title: "Uptime Kuma Alert",
                status: status,
                monitor: monitorJSON?.name || "No Monitor",
                message: msg,
                timestamp: new Date().toISOString(),
                uptime_kuma_version: process.env.npm_package_version || "unknown",
            };

            // Send POST request to Halo PSA webhook
            let config = {
                headers: {
                    "Content-Type": "application/json",
                },
            };

            if (notification.haloUsername && notification.haloPassword) {
                const data = notification.haloUsername + ":" + notification.haloPassword;
                const base64data = Buffer.from(data).toString("base64");

                config.headers.Authorization = `Basic ${base64data}`;
            }

            config = this.getAxiosConfigWithProxy(config);

            const result = await axios.post(notification.halowebhookurl, payload, config);

            // Check for successful HTTP response
            if (result.status === 200 || result.status === 201 || result.status === 204) {
                return okMsg;
            }

            throw new Error(`Received unexpected status code ${result.status} from notification provider HaloPSA`);
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = HaloPSA;
