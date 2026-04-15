const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Gotify extends NotificationProvider {
    name = "gotify";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (notification.gotifyserverurl && notification.gotifyserverurl.endsWith("/")) {
                notification.gotifyserverurl = notification.gotifyserverurl.slice(0, -1);
            }

            let title = "Uptime-Kuma";
            let message = msg;

            if (notification.gotifyUseTemplate) {
                const customTitle = notification.gotifyTitleTemplate?.trim() || "";
                if (customTitle !== "") {
                    title = await this.renderTemplate(customTitle, msg, monitorJSON, heartbeatJSON);
                }

                const customMessage = notification.gotifyMessageTemplate?.trim() || "";
                if (customMessage !== "") {
                    message = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                }
            }

            await axios.post(
                `${notification.gotifyserverurl}/message?token=${notification.gotifyapplicationToken}`,
                {
                    message: message,
                    priority: notification.gotifyPriority || 8,
                    title: title,
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Gotify;
