const { R } = require("redbean-node");
const Apprise = require("./notification-providers/apprise");
const Discord = require("./notification-providers/discord");
const Gotify = require("./notification-providers/gotify");
const Line = require("./notification-providers/line");
const LunaSea = require("./notification-providers/lunasea");
const Mattermost = require("./notification-providers/mattermost");
const Matrix = require("./notification-providers/matrix");
const Octopush = require("./notification-providers/octopush");
const PromoSMS = require("./notification-providers/promosms");
const ClickSendSMS = require("./notification-providers/clicksendsms");
const Pushbullet = require("./notification-providers/pushbullet");
const Pushover = require("./notification-providers/pushover");
const Pushy = require("./notification-providers/pushy");
const TechulusPush = require("./notification-providers/techulus-push");
const RocketChat = require("./notification-providers/rocket-chat");
const Signal = require("./notification-providers/signal");
const Slack = require("./notification-providers/slack");
const SMTP = require("./notification-providers/smtp");
const Teams = require("./notification-providers/teams");
const Telegram = require("./notification-providers/telegram");
const Webhook = require("./notification-providers/webhook");
const Feishu = require("./notification-providers/feishu");
const AliyunSms = require("./notification-providers/aliyun-sms");
const DingDing = require("./notification-providers/dingding");
const Bark = require("./notification-providers/bark");
const { log } = require("../src/util");
const SerwerSMS = require("./notification-providers/serwersms");
const Stackfield = require("./notification-providers/stackfield");
const WeCom = require("./notification-providers/wecom");
const GoogleChat = require("./notification-providers/google-chat");
const Gorush = require("./notification-providers/gorush");
const Alerta = require("./notification-providers/alerta");
const OneBot = require("./notification-providers/onebot");
const PushDeer = require("./notification-providers/pushdeer");

class Notification {

    providerList = {};

    /** Initialize the notification providers */
    static init() {
        log.info("notification", "Prepare Notification Providers");

        this.providerList = {};

        const list = [
            new Apprise(),
            new AliyunSms(),
            new DingDing(),
            new Discord(),
            new Teams(),
            new Gotify(),
            new Line(),
            new LunaSea(),
            new Feishu(),
            new Mattermost(),
            new Matrix(),
            new Octopush(),
            new PromoSMS(),
            new ClickSendSMS(),
            new Pushbullet(),
            new Pushover(),
            new Pushy(),
            new TechulusPush(),
            new RocketChat(),
            new Signal(),
            new Slack(),
            new SMTP(),
            new Telegram(),
            new Webhook(),
            new Bark(),
            new SerwerSMS(),
            new Stackfield(),
            new WeCom(),
            new GoogleChat(),
            new Gorush(),
            new Alerta(),
            new OneBot(),
            new PushDeer(),
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
     * Send a notification
     * @param {BeanModel} notification
     * @param {string} msg General Message
     * @param {Object} monitorJSON Monitor details (For Up/Down only)
     * @param {Object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Successful msg
     * @throws Error with fail msg
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (this.providerList[notification.type]) {
            return this.providerList[notification.type].send(notification, msg, monitorJSON, heartbeatJSON);
        } else {
            throw new Error("Notification type is not supported");
        }
    }

    /**
     * Save a notification
     * @param {Object} notification Notification to save
     * @param {?number} notificationID ID of notification to update
     * @param {number} userID ID of user who adds notification
     * @returns {Promise<Bean>}
     */
    static async save(notification, notificationID, userID) {
        let bean;

        if (notificationID) {
            bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
                notificationID,
                userID,
            ]);

            if (! bean) {
                throw new Error("notification not found");
            }

        } else {
            bean = R.dispense("notification");
        }

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification);
        bean.is_default = notification.isDefault || false;
        await R.store(bean);

        if (notification.applyExisting) {
            await applyNotificationEveryMonitor(bean.id, userID);
        }

        return bean;
    }

    /**
     * Delete a notification
     * @param {number} notificationID ID of notification to delete
     * @param {number} userID ID of user who created notification
     * @returns {Promise<void>}
     */
    static async delete(notificationID, userID) {
        let bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
            notificationID,
            userID,
        ]);

        if (! bean) {
            throw new Error("notification not found");
        }

        await R.trash(bean);
    }

    /**
     * Check if apprise exists
     * @returns {boolean} Does the command apprise exist?
     */
    static checkApprise() {
        let commandExistsSync = require("command-exists").sync;
        let exists = commandExistsSync("apprise");
        return exists;
    }

}

/**
 * Apply the notification to every monitor
 * @param {number} notificationID ID of notification to apply
 * @param {number} userID ID of user who created notification
 * @returns {Promise<void>}
 */
async function applyNotificationEveryMonitor(notificationID, userID) {
    let monitors = await R.getAll("SELECT id FROM monitor WHERE user_id = ?", [
        userID
    ]);

    for (let i = 0; i < monitors.length; i++) {
        let checkNotification = await R.findOne("monitor_notification", " monitor_id = ? AND notification_id = ? ", [
            monitors[i].id,
            notificationID,
        ]);

        if (! checkNotification) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitors[i].id;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

module.exports = {
    Notification,
};
