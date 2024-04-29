const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL, UP, DOWN } = require("../../src/util");

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

            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = `[${heartbeatJSON.name}] ✅ Application is back online`;
                status = "close";
                eventType = "INFO";
                eventId += `_${heartbeatJSON.name.replace(/\s/g, "")}`;
            } else if (heartbeatJSON && heartbeatJSON.status === DOWN) {
                textMsg = `[${heartbeatJSON.name}] 🔴 Application went down`;
            }

            textMsg += ` - ${msg}`;

            const baseURL = await setting("primaryBaseURL");
            if (baseURL && monitorJSON) {
                textMsg += ` >> ${baseURL + getMonitorRelativeURL(monitorJSON.id)}`;
            }

            const data = {
                "summary": textMsg,
                "status": status,
                "event_type": eventType,
                "event_id": eventId,
            };

            await axios.post(notification.alertNowWebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = AlertNow;
