const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class GoogleSheets extends NotificationProvider {
    name = "GoogleSheets";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // Prepare the data to be logged
            const timestamp = new Date().toISOString();
            let status = "N/A";
            let monitorName = "N/A";
            let monitorUrl = "N/A";
            let responseTime = "N/A";
            let statusCode = "N/A";

            if (monitorJSON) {
                monitorName = monitorJSON.name || "N/A";
                monitorUrl = this.extractAddress(monitorJSON) || "N/A";
            }

            if (heartbeatJSON) {
                status = heartbeatJSON.status === DOWN ? "DOWN" : heartbeatJSON.status === UP ? "UP" : "UNKNOWN";
                responseTime = heartbeatJSON.ping || "N/A";
                statusCode = heartbeatJSON.statusCode || "N/A";
            }

            // Send data to Google Apps Script webhook
            const config = this.getAxiosConfigWithProxy({
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const data = {
                timestamp,
                status,
                monitorName,
                monitorUrl,
                message: msg,
                responseTime,
                statusCode,
            };

            await axios.post(notification.googleSheetsWebhookUrl, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GoogleSheets;
