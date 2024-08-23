const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const axios = require('axios');

class EgoSMS extends NotificationProvider {

    name = "EgoSMS";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const username = notification.egosmsUsername;
        const password = notification.egosmsPassword;
        const sender = notification.egosmsSender || "EGOSMS";
        const number = notification.egosmsPhoneNumber;
        let message = msg;

        if (heartbeatJSON != null) {
            // Modify the message based on the status (UP/DOWN)
            if (heartbeatJSON["status"] === DOWN) {
                message = `Service ${monitorJSON["name"]} is down!`;
            } else if (heartbeatJSON["status"] === UP) {
                message = `Service ${monitorJSON["name"]} is back up!`;
            }
        }

        const url = `https://www.egosms.co/api/v1/plain/?number=${number}&message= ${message}& username=${username}& password=${password}&sender=${sender}&priority=${'0'}`;
        //const url = `https://www.egosms.co/api/v1/plain/?number=${encodeURIComponent(number)}&message=${encodeURIComponent(message)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&sender=${encodeURIComponent(sender)}&priority=0`;

        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error(`Failed to send SMS: ${error.message}`);
            throw new Error(`Failed to send SMS: ${error.message}`);
        }
    }
}

module.exports = EgoSMS;
