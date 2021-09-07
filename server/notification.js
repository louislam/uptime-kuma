const { R } = require("redbean-node");
const Apprise = require("./notification-providers/apprise");
const Discord = require("./notification-providers/discord");
const Gotify = require("./notification-providers/gotify");
const Line = require("./notification-providers/line");
const LunaSea = require("./notification-providers/lunasea");
const Mattermost = require("./notification-providers/mattermost");
const Octopush = require("./notification-providers/octopush");
const Pushbullet = require("./notification-providers/pushbullet");
const Pushover = require("./notification-providers/pushover");
const Pushy = require("./notification-providers/pushy");
const RocketChat = require("./notification-providers/rocket-chat");
const Signal = require("./notification-providers/signal");
const Slack = require("./notification-providers/slack");
const SMTP = require("./notification-providers/smtp");
const Telegram = require("./notification-providers/telegram");
const Webhook = require("./notification-providers/webhook");

class Notification {

    providerList = {};

    static init() {
        console.log("Prepare Notification Providers");

        this.providerList = {};

        const list = [
            new Apprise(),
            new Discord(),
            new Gotify(),
            new Line(),
            new LunaSea(),
            new Mattermost(),
            new Octopush(),
            new Pushbullet(),
            new Pushover(),
            new Pushy(),
            new RocketChat(),
            new Signal(),
            new Slack(),
            new SMTP(),
            new Telegram(),
            new Webhook(),
        ];

        for (let item of list) {
            if (! item.name) {
                throw new Error("Notification provider without name");
            }

            if (this.providerList[item.name]) {
                throw new Error("Duplicate notification provider name");
            }
            this.providerList[item.name] = item;
        }
    }

    /**
     *
     * @param notification : BeanModel
     * @param msg : string General Message
     * @param monitorJSON : object Monitor details (For Up/Down only)
     * @param heartbeatJSON : object Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Successful msg
     * Throw Error with fail msg
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (this.providerList[notification.type]) {
            return this.providerList[notification.type].send(notification, msg, monitorJSON, heartbeatJSON);
        } else {
            throw new Error("Notification type is not supported");
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

    static checkApprise() {
        let commandExistsSync = require("command-exists").sync;
        let exists = commandExistsSync("apprise");
        return exists;
    }

}

module.exports = {
    Notification,
}
