const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const Crypto = require('crypto')

class Matrix extends NotificationProvider {
    name = "matrix";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully. ";

        const size = 20;
        const randomString = Crypto
            .randomBytes(size)
            .toString('base64')
            .slice(0, size);    

        try {
            let config = {
                headers: {
                    "Authorization": `Bearer ${notification.accessToken}`,
                }
            };
            let data = {
                "msgtype": "m.text",
                "body": msg
            };

            await axios.put(`${notification.homeserverUrl}/_matrix/client/r0/rooms/${notification.internalRoomId}/send/m.room.message/${randomString}`, data, config)
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Matrix;
