const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class GrafanaOncall extends NotificationProvider {
    name = "GrafanaOncall";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        if (!notification.GrafanaOncallURL) {
            throw new Error("GrafanaOncallURL cannot be empty");
        }

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (heartbeatJSON === null) {
                let grafanaupdata = {
                    title: "General notification",
                    message: msg,
                    state: "alerting",
                };
                await axios.post(notification.GrafanaOncallURL, grafanaupdata, config);
                return okMsg;
            } else if (heartbeatJSON["status"] === DOWN) {
                let grafanadowndata = {
                    title: monitorJSON["name"] + " is down",
                    message: heartbeatJSON["msg"],
                    state: "alerting",
                };
                await axios.post(notification.GrafanaOncallURL, grafanadowndata, config);
                return okMsg;
            } else if (heartbeatJSON["status"] === UP) {
                let grafanaupdata = {
                    title: monitorJSON["name"] + " is up",
                    message: heartbeatJSON["msg"],
                    state: "ok",
                };
                await axios.post(notification.GrafanaOncallURL, grafanaupdata, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = GrafanaOncall;
