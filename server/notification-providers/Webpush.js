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
            // Get VAPID keys from settings
            const publicVapidKey = await setting("webpushPublicVapidKey");
            const privateVapidKey = await setting("webpushPrivateVapidKey");
            // Set Vapid keys in web-push helper lib
            webpush.setVapidDetails("https://github.com/louislam/uptime-kuma", publicVapidKey, privateVapidKey);

            if (heartbeatJSON === null && monitorJSON === null) {
                // Test message
                const data = JSON.stringify({
                    title: "TEST",
                    body: "Test Alert - " + msg
                });
                //send push notification using web-push lib
                await webpush.sendNotification(notification.subscription, data);

                return okMsg;
            }

            const title = `Monitor ${heartbeatJSON["status"] === UP ? "UP" : "DOWN"}`;
            const down = "❌ " + monitorJSON["name"] + " is DOWN ❌";
            const up = "✅ " + monitorJSON["name"] + " is UP ✅";

            const data = JSON.stringify({
                title: title,
                body: `${heartbeatJSON["status"] === UP ? up : down}`
            });
            //send push notification using web-push lib
            await webpush.sendNotification(notification.subscription, data);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Webpush;
