const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Jabee extends NotificationProvider {
    name = "jabee";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.jabeeBaseURL || "https://api.jabee.ai";

        try {
            const config = this.getAxiosConfigWithProxy({
                headers: {
                    Authorization: "Bearer " + notification.jabeeApiKey,
                    "Content-Type": "application/json",
                },
            });

            const data = {
                title: this.title(msg, monitorJSON, heartbeatJSON),
                body: msg,
            };

            // The monitor's own URL, so the message on the phone links to
            // the thing that is down rather than to the dashboard.
            if (monitorJSON?.url && monitorJSON.url !== "https://") {
                data.url = monitorJSON.url;
            }

            // Jabee returns the existing alert for a repeated external_id,
            // so a retry cannot message somebody twice about one event.
            if (monitorJSON?.id && heartbeatJSON?.time) {
                data.external_id = `uptime-kuma-${monitorJSON.id}-${heartbeatJSON.time}`;
            }

            const result = await axios.post(`${url}/api/v1/alerts`, data, config);
            if (result.status === 200 || result.status === 201) {
                return okMsg;
            }
            throw new Error(`Jabee replied with ${result.status}`);
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * The bold first line on the phone, within Jabee's 120-character limit.
     * @param {string} msg the message Uptime Kuma built
     * @param {?object} monitorJSON the monitor, absent on a test message
     * @param {?object} heartbeatJSON the heartbeat, absent on a test or a certificate notice
     * @returns {string} a title of at most 120 characters
     */
    title(msg, monitorJSON, heartbeatJSON) {
        let title;
        if (heartbeatJSON?.status === DOWN) {
            title = `🔴 ${monitorJSON?.name} is down`;
        } else if (heartbeatJSON?.status === UP) {
            title = `✅ ${monitorJSON?.name} is up`;
        } else if (monitorJSON?.name) {
            // A certificate or domain expiry notice: no heartbeat, but a monitor.
            title = `⚠️ ${monitorJSON.name}`;
        } else {
            title = msg;
        }
        return title.length > 120 ? title.slice(0, 119) + "…" : title;
    }
}

module.exports = Jabee;
