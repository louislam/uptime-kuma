const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class ServerChan extends NotificationProvider {

    name = "ServerChan";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            await axios.post(`https://sctapi.ftqq.com/${notification.serverChanSendKey}.send`, {
                "title": this.checkStatus(heartbeatJSON, monitorJSON),
                "desp": msg,
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    checkStatus(heartbeatJSON, monitorJSON) {
        let title = "UptimeKuma Message";
        if (heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            title = "UptimeKuma Monitor Up " + monitorJSON["name"];
        }
        if (heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            title = "UptimeKuma Monitor Down " + monitorJSON["name"];
        }
        return title;
    }
}

module.exports = ServerChan;
