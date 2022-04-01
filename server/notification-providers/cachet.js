const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Cachet extends NotificationProvider {

    name = "Cachet";

    _bodyFactory = (status, cachetFatalState) => {
        if (status === DOWN) {
            return `{"status":"`+cachetFatalState+`"}`;
        } else if (status === UP) {
            return `{"status":"1"}`;
        } else {
            return `{"status":"O"}`;
        }
    };

    _sendNotification = async (url, token, body) => {
        await axios.put(
            url,
            body,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Cachet-Token': token,
                }
            }
        );
    };

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON == null) {
                return "Sent Successfully.";
            }

            const body = this._bodyFactory(heartbeatJSON.status, notification.cachetFatalState);

            await this._sendNotification(notification.cachetUrl+"/api/v1/components/"+notification.cachetComponentId, notification.cachetToken, body);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Cachet;
