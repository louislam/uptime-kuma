const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class GrafanaOncall extends NotificationProvider {

    name = "GrafanaOncall";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {

            // If heartbeatJSON is null, assume we're testing.
            if (heartbeatJSON == null) {
                let GrafanaOncallTestData = {
                    title: "This is a test",
                    message: msg,
                };
                await axios.post(notification.grafanaoncallURL, GrafanaOncallTestData);
                return okMsg;
            }

            if (heartbeatJSON["status"] === DOWN) {
                let grafanadowndata = {
                    title: monitorJSON["name"] + " is down",
                    message: heartbeatJSON["msg"],
                };
                await axios.post(
                    notification.grafanaoncallURL,
                    grafanadowndata
                );
                return okMsg;
            } else if (heartbeatJSON["status"] === UP) {
                let grafanaupdata = {
                    title: monitorJSON["name"] + " is up",
                    message: heartbeatJSON["msg"],
                    state: "ok",
                };
                await axios.post(
                    notification.grafanaoncallURL,
                    grafanaupdata
                );
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = GrafanaOncall;
