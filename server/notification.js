const axios = require("axios");
const {R} = require("redbean-node");

class Notification {
    static async send(notification, msg) {
        if (notification.type === "telegram") {
            let res = await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                params: {
                    chat_id: notification.telegramChatID,
                    text: msg,
                }
            })
            return true;
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
