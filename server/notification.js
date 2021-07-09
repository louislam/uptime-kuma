const axios = require("axios");
const {R} = require("redbean-node");
const FormData = require('form-data');

class Notification {
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (notification.type === "telegram") {
            try {
                await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                    params: {
                        chat_id: notification.telegramChatID,
                        text: msg,
                    }
                })
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else if (notification.type === "webhook") {
            try {

                let data = {
                    heartbeat: heartbeatJSON,
                    monitor: monitorJSON,
                    msg,
                };
                let finalData;
                let config = {};

                if (notification.webhookContentType === "form-data") {
                    finalData = new FormData();
                    finalData.append('data', JSON.stringify(data));

                    config = {
                        headers: finalData.getHeaders()
                    }

                } else {
                    finalData = data;
                }

                let res = await axios.post(notification.webhookURL, finalData, config)

                console.log(res.data)

                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else {
            throw new Error("Notification type is not supported")
        }
    }

    static async save(notification, notificationID, userID) {
        let bean

        if (notificationID) {
            bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
                notificationID,
                userID,
            ])

            if (! bean) {
                throw new Error("notification not found")
            }

        } else {
            bean = R.dispense("notification")
        }

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification)
        await R.store(bean)
    }

    static async delete(notificationID, userID) {
        let bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
            notificationID,
            userID,
        ])

        if (! bean) {
            throw new Error("notification not found")
        }

        await R.trash(bean)
    }
}

module.exports = {
    Notification,
}
