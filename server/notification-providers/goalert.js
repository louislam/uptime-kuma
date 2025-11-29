const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP } = require("../../src/util");

class GoAlert extends NotificationProvider {
    name = "GoAlert";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                summary: msg,
            };
            if (heartbeatJSON != null && heartbeatJSON["status"] === UP) {
                data["action"] = "close";
            }
            let headers = {
                "Content-Type": "multipart/form-data",
            };
            let config = {
                headers: headers
            };
            config = this.getAxiosConfigWithProxy(config);
            await axios.post(`${notification.goAlertBaseURL}/api/v2/generic/incoming?token=${notification.goAlertToken}`, data, config);
            return okMsg;
        } catch (error) {
            let msg = (error.response.data) ? error.response.data : "Error without response";
            throw new Error(msg);
        }
    }
}

module.exports = GoAlert;
