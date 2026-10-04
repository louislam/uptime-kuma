const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Pinglet extends NotificationProvider {
    name = "pinglet";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let publishUrl = notification.pingletPublishUrl;
            if (publishUrl.endsWith("/")) {
                publishUrl = publishUrl.slice(0, -1);
            }

            const config = this.getAxiosConfigWithProxy({
                headers: {
                    Authorization: "Bearer " + notification.pingletApiKey,
                },
                params: {
                    rewrite: "uptimekuma",
                },
            });

            // Pinglet's uptimekuma rewriter accepts Uptime Kuma's webhook payload
            // as-is and maps it to a titled message with level and priority
            // server-side, so this provider just forwards the raw shape.
            await axios.post(
                publishUrl,
                {
                    heartbeat: heartbeatJSON,
                    monitor: monitorJSON,
                    msg,
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Pinglet;
