const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class VK extends NotificationProvider {
    name = "VK";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.vk.ru/method/messages.send";

        try {
            const data = new URLSearchParams({
                access_token: notification.vkAccessToken,
                v: notification.vkApiVersion,
                peer_id: notification.vkPeerId,
                message: msg,
                dont_parse_links: notification.vkDontParseLinks ? "1" : "0",
                random_id: String(Math.floor(Math.random() * 2147483646) + 1),
            });

            const config = this.getAxiosConfigWithProxy({});
            const response = await axios.post(url, data, config);

            if (response.data?.error) {
                this.throwGeneralAxiosError(
                    new Error(
                        `VK API returned error ${response.data.error.error_code}: ${response.data.error.error_msg}`
                    )
                );
            }

            if (typeof response.data?.response === "undefined") {
                this.throwGeneralAxiosError(new Error("Invalid VK API response"));
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = VK;
