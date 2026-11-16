const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { getMonitorRelativeURL, UP, DOWN } = require("../../src/util");
const { Settings } = require("../settings");

class AlertNow extends NotificationProvider {
    name = "AlertNow";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        try {
            let textMsg = "";
            let status = "open";
            let eventType = "ERROR";
            let eventId = new Date().toISOString().slice(0, 10).replace(/-/g, "");

            // Heartbeats carry no `name` (see Heartbeat#toJSON) — the monitor
            // name lives on monitorJSON.
            const monitorName = monitorJSON?.name;

            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = `[${monitorName}] ✅ Application is back online`;
                status = "close";
                eventType = "INFO";
                eventId += `_${(monitorName ?? "").replace(/\s/g, "")}`;
            } else if (heartbeatJSON && heartbeatJSON.status === DOWN) {
                textMsg = `[${monitorName}] 🔴 Application went down`;
            }

            textMsg += ` - ${msg}`;

            const baseURL = await Settings.get("primaryBaseURL");
            if (baseURL && monitorJSON) {
                textMsg += ` >> ${baseURL + getMonitorRelativeURL(monitorJSON.id)}`;
            }

            const data = {
                summary: textMsg,
                status: status,
                event_type: eventType,
                event_id: eventId,
            };

            let config = this.getAxiosConfigWithProxy({});
            await axios.post(notification.alertNowWebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = AlertNow;
