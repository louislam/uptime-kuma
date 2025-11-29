const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN } = require("../../src/util");

const opsgenieAlertsUrlEU = "https://api.eu.opsgenie.com/v2/alerts";
const opsgenieAlertsUrlUS = "https://api.opsgenie.com/v2/alerts";
const okMsg = "Sent Successfully.";

class Opsgenie extends NotificationProvider {
    name = "Opsgenie";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let opsgenieAlertsUrl;
        let priority = (!notification.opsgeniePriority) ? 3 : notification.opsgeniePriority;
        const textMsg = "Uptime Kuma Alert";

        try {
            switch (notification.opsgenieRegion) {
                case "us":
                    opsgenieAlertsUrl = opsgenieAlertsUrlUS;
                    break;
                case "eu":
                    opsgenieAlertsUrl = opsgenieAlertsUrlEU;
                    break;
                default:
                    opsgenieAlertsUrl = opsgenieAlertsUrlUS;
            }

            if (heartbeatJSON == null) {
                let notificationTestAlias = "uptime-kuma-notification-test";
                let data = {
                    "message": msg,
                    "alias": notificationTestAlias,
                    "source": "Uptime Kuma",
                    "priority": "P5"
                };

                return this.post(notification, opsgenieAlertsUrl, data);
            }

            if (heartbeatJSON.status === DOWN) {
                let data = {
                    "message": monitorJSON ? textMsg + `: ${monitorJSON.name}` : textMsg,
                    "alias": monitorJSON.name,
                    "description": msg,
                    "source": "Uptime Kuma",
                    "priority": `P${priority}`
                };

                return this.post(notification, opsgenieAlertsUrl, data);
            }

            if (heartbeatJSON.status === UP) {
                let opsgenieAlertsCloseUrl = `${opsgenieAlertsUrl}/${encodeURIComponent(monitorJSON.name)}/close?identifierType=alias`;
                let data = {
                    "source": "Uptime Kuma",
                };

                return this.post(notification, opsgenieAlertsCloseUrl, data);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Make POST request to Opsgenie
     * @param {BeanModel} notification Notification to send
     * @param {string} url Request url
     * @param {object} data Request body
     * @returns {Promise<string>} Success message
     */
    async post(notification, url, data) {
        let config = {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `GenieKey ${notification.opsgenieApiKey}`,
            }
        };
        config = this.getAxiosConfigWithProxy(config);

        let res = await axios.post(url, data, config);
        if (res.status == null) {
            return "Opsgenie notification failed with invalid response!";
        }
        if (res.status < 200 || res.status >= 300) {
            return `Opsgenie notification failed with status code ${res.status}`;
        }

        return okMsg;
    }
}

module.exports = Opsgenie;
