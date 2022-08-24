const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP } = require("../../src/util");

class GoAlert extends NotificationProvider {

    name = "GoAlert";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        let closeAction = "close";
        let parameters = {
            token: notification.goAlertToken,
            summary: msg,
        };
        // if (heartbeatJSON["status"] === UP) {
        //     parameters["action"] = closeAction;
        // }
        try {
            await axios.post(`${notification.goAlertBaseURL}/api/v2/generic/incoming`, {
                params: parameters,
            });
            return okMsg;

        } catch (error) {
            let msg = (error.response.data) ? error.response.data : "Error without response";
            console.log(error)
            throw new Error(msg);
        }
    }
}

module.exports = GoAlert;
