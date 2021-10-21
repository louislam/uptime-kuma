const { R } = require("redbean-node");
const { Liquid } = require( "liquidjs");
const { UP } = require("../src/util");
const dayjs = require("dayjs");

const engine = new Liquid();

const Apprise = require("./notification-providers/apprise");
const Discord = require("./notification-providers/discord");
const Gotify = require("./notification-providers/gotify");
const Line = require("./notification-providers/line");
const LunaSea = require("./notification-providers/lunasea");
const Mattermost = require("./notification-providers/mattermost");
const Matrix = require("./notification-providers/matrix");
const Octopush = require("./notification-providers/octopush");
const PromoSMS = require("./notification-providers/promosms");
const Pushbullet = require("./notification-providers/pushbullet");
const Pushover = require("./notification-providers/pushover");
const Pushy = require("./notification-providers/pushy");
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

const MinimalDetailTemplate = "{{monitor.name}}: {{monitor.health}}";
const LowDetailTemplate = "[{{monitor.name}}] [{{monitor.health}}] {{heartbeat.msg}}";
const MediumDetailTemplate = `Monitor: {{monitor.name}}
Health: {{monitor.health}}
Address: {{monitor.url}}

{% if heartbeat.status == 1 and monitor.upsideDown -%}
    Your Upside down {{monitor.type}} monitor is unexpectedly connected
{%- elsif heartbeat.status == 1 and monitor.upsideDown==false -%}
    Your {{monitor.type}} monitor is up
{%- elsif heartbeat.status == 0 and monitor.upsideDown -%}
    Your Upside down {{monitor.type}} monitor is no longer connected
{%- elsif heartbeat.status == 0 and monitor.upsideDown == false -%}
    Your {{monitor.type}} monitor is unexpectedly down.
{%- endif %}
Time: {{heartbeat.time}}
Uptime Message: {{heartbeat.msg}}`;

const FullDetailTemplate = `Monitor: {{monitor.name}}
Health: {{monitor.health}}
Address: {{monitor.url}}

{% if heartbeat.status == 1 and monitor.upsideDown -%}
    Your Upside down {{monitor.type}} monitor is unexpectedly connected
{%- elsif heartbeat.status == 1 and monitor.upsideDown==false -%}
    Your {{monitor.type}} monitor is up
{%- elsif heartbeat.status == 0 and monitor.upsideDown -%}
    Your Upside down {{monitor.type}} monitor is no longer connected
{%- elsif heartbeat.status == 0 and monitor.upsideDown == false -%}
    Your {{monitor.type}} monitor is unexpectedly down.
{%- endif %}
Time: {{heartbeat.time}}
Uptime Message: {{heartbeat.msg}}

Tags
----------------------------------------
{% for tag in monitor.tags -%}
  {{ tag.name }}
  {%- if tag.value and tag.value != "" -%}
    : {{tag.value}}
  {%- endif %}
{% endfor -%}`;

class Notification {

    static generateTestHeartbeat() {
        return {
            monitorID: 5,
            status: 1,
            time: R.isoDateTime(dayjs.utc()),
            msg: "TEST NOTIFICATION MESSAGE",
            ping: 278,
            important: true,
            duration: 8,
        };
    }

    static generateTestMonitor() {
        return {
            id: 5,
            name: "Test Notification Monitor",
            url: "https://www.example.com",
            method: "Get",
            body: "OK",
            headers: null,
            hostname: "www.example.com",
            port: 443,
            maxretries: 2,
            weight: 2000,
            active: 1,
            type: "HTTP",
            interval: 60,
            retryInterval: this.retryInterval,
            keyword: null,
            ignoreTls: false,
            upsideDown: false,
            maxredirects: 10,
            accepted_statuscodes: ["200-299"],
            dns_resolve_type: "A",
            dns_resolve_server: "1.1.1.1",
            dns_last_result: null,
            pushToken: null,
            notificationIDList: { "1": true,
                "5": true },
            tags: [{ "id": 21,
                "monitor_id": 16,
                "tag_id": 2,
                "value": "",
                "name": "Internal",
                "color": "#059669" }],
        };
    }

    providerList = {};

    static init() {
        console.log("Prepare Notification Providers");

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
    static async send(notification, msg, monitorJSON, heartbeatJSON) {
        if (this.providerList[notification.type]) {

            monitorJSON.health = ((heartbeatJSON.status == 1) !== monitorJSON.upsideDown) ? "✅ Healthy" : "❌ Unhealthy";

            let parseData = {
                // I actually dont think that it is necessary to put the notification in the data sent to the template.
                // notification: notification,
                monitor: monitorJSON,
                heartbeat: heartbeatJSON,
            };
            let template = this.getTemplateFromNotification(notification);
            console.log(`Template: (${template})`);
            let message = await engine.parseAndRender(template, parseData);

            return this.providerList[notification.type].send(notification, message, monitorJSON, heartbeatJSON);

            //Removed try-catch here. I am not sure what the default should be in the case of a broken template.
            //switch to manually building the message?
            //the problem is that it would still need to send a message after the template fails of if it failed to send completely..
            //im not sure if that is the desired result on a template fail.

        } else {
            throw new Error("Notification type is not supported");
        }
    }

    static getTemplateFromNotification(notification) {

        let template = notification.template;
        let detail = notification.detail;
        console.log(`Detail: (${detail}) Template: (${template})`);
        switch (detail) {
            case "Minimal Detail":
                return MinimalDetailTemplate;
            case "Low Detail":
                return LowDetailTemplate;
            case "Medium Detail":
                return MediumDetailTemplate;
            case "Full Detail":
                return FullDetailTemplate;
            case "Custom Template":
                if (template) {
                    return template;
                }
                //returns low in the case of a template being empty string or undefined.
        }
        return LowDetailTemplate;
    }

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

    static checkApprise() {
        let commandExistsSync = require("command-exists").sync;
        let exists = commandExistsSync("apprise");
        return exists;
    }

}

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
