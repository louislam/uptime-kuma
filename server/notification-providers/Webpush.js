const NotificationProvider = require("./notification-provider");
const { UP } = require("../../src/util");
const webpush = require("web-push");
const { setting } = require("../util-server");

class Webpush extends NotificationProvider {
    name = "Webpush";

    /**
     * @inheritDoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const publicVapidKey = await setting("webpushPublicVapidKey");
            const privateVapidKey = await setting("webpushPrivateVapidKey");

            webpush.setVapidDetails("https://github.com/louislam/uptime-kuma", publicVapidKey, privateVapidKey);

            if (heartbeatJSON === null && monitorJSON === null) {
                // Test message
                const data = JSON.stringify({
                    title: "TEST",
                    body: `Test Alert - ${msg}`
                });

                await webpush.sendNotification(notification.subscription, data);

                return okMsg;
            }

            const data = JSON.stringify({
                title: heartbeatJSON["status"] === UP ? "Monitor Up" : "Monitor DOWN",
                body: heartbeatJSON["status"] === UP ? `❌ ${heartbeatJSON["name"]} is DOWN` : `✅ ${heartbeatJSON["name"]} is UP`
            });

            await webpush.sendNotification(notification.subscription, data);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Webpush;
