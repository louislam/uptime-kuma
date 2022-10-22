const { R } = require("redbean-node");
const { log } = require("../src/util");
const Alerta = require("./notification-providers/alerta");
const AlertNow = require("./notification-providers/alertnow");
const AliyunSms = require("./notification-providers/aliyun-sms");
const Apprise = require("./notification-providers/apprise");
const Bark = require("./notification-providers/bark");
const ClickSendSMS = require("./notification-providers/clicksendsms");
const DingDing = require("./notification-providers/dingding");
const Discord = require("./notification-providers/discord");
const Feishu = require("./notification-providers/feishu");
const FreeMobile = require("./notification-providers/freemobile");
const GoogleChat = require("./notification-providers/google-chat");
const Gorush = require("./notification-providers/gorush");
const Gotify = require("./notification-providers/gotify");
const HomeAssistant = require("./notification-providers/home-assistant");
const Line = require("./notification-providers/line");
const LineNotify = require("./notification-providers/linenotify");
const LunaSea = require("./notification-providers/lunasea");
const Matrix = require("./notification-providers/matrix");
const Mattermost = require("./notification-providers/mattermost");
const Ntfy = require("./notification-providers/ntfy");
const Octopush = require("./notification-providers/octopush");
const OneBot = require("./notification-providers/onebot");
const PagerDuty = require("./notification-providers/pagerduty");
const PromoSMS = require("./notification-providers/promosms");
const Pushbullet = require("./notification-providers/pushbullet");
const PushDeer = require("./notification-providers/pushdeer");
const Pushover = require("./notification-providers/pushover");
const Pushy = require("./notification-providers/pushy");
const RocketChat = require("./notification-providers/rocket-chat");
const SerwerSMS = require("./notification-providers/serwersms");
const Signal = require("./notification-providers/signal");
const Slack = require("./notification-providers/slack");
const SMTP = require("./notification-providers/smtp");
const Squadcast = require("./notification-providers/squadcast");
const Stackfield = require("./notification-providers/stackfield");
const Teams = require("./notification-providers/teams");
const TechulusPush = require("./notification-providers/techulus-push");
const Telegram = require("./notification-providers/telegram");
const Webhook = require("./notification-providers/webhook");
const WeCom = require("./notification-providers/wecom");
const GoAlert = require("./notification-providers/goalert");
const SMSManager = require("./notification-providers/smsmanager");
const ServerChan = require("./notification-providers/serverchan");

class Notification {

    providerList = {};

    /** Initialize the notification providers */
    static init() {
        log.info("notification", "Prepare Notification Providers");

        this.providerList = {};

        const list = [
            new Alerta(),
            new AlertNow(),
            new AliyunSms(),
            new Apprise(),
            new Bark(),
            new ClickSendSMS(),
            new DingDing(),
            new Discord(),
            new Feishu(),
            new FreeMobile(),
            new GoogleChat(),
            new Gorush(),
            new Gotify(),
            new HomeAssistant(),
            new Line(),
            new LineNotify(),
            new LunaSea(),
            new Matrix(),
            new Mattermost(),
            new Ntfy(),
            new Octopush(),
            new OneBot(),
            new PagerDuty(),
            new PromoSMS(),
            new Pushbullet(),
            new PushDeer(),
            new Pushover(),
            new Pushy(),
            new RocketChat(),
            new ServerChan(),
            new SerwerSMS(),
            new Signal(),
            new SMSManager(),
            new Slack(),
            new SMTP(),
            new Squadcast(),
            new Stackfield(),
            new Teams(),
            new TechulusPush(),
            new Telegram(),
            new Webhook(),
            new WeCom(),
            new GoAlert(),
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
