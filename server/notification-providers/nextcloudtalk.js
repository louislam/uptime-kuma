const { UP, DOWN } = require("../../src/util");
const Crypto = require("crypto");

const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class NextcloudTalk extends NotificationProvider {
    name = "nextcloudtalk";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        // See documentation at https://nextcloud-talk.readthedocs.io/en/latest/bots/#sending-a-chat-message
        const okMsg = "Sent Successfully.";

        // Create a random string
        const talkRandom = encodeURIComponent(
            Crypto
                .randomBytes(64)
                .toString("hex")
                .slice(0, 64)
        );

        // Create the signature over random and message
        const talkSignature = Crypto
            .createHmac("sha256", Buffer.from(notification.botSecret, "utf8"))
            .update(Buffer.from(`${talkRandom}${msg}`, "utf8"))
            .digest("hex");

        let silentUp = (heartbeatJSON?.status === UP && notification.sendSilentUp);
        let silentDown = (heartbeatJSON?.status === DOWN && notification.sendSilentDown);
        let silent = (silentUp || silentDown);

        let url = `${notification.host}/ocs/v2.php/apps/spreed/api/v1/bot/${notification.conversationToken}/message`;
        let config = this.getAxiosConfigWithProxy({});

        const data = {
            message: msg,
            silent
        };

        const options = {
            ...config,
            headers: {
                "X-Nextcloud-Talk-Bot-Random": talkRandom,
                "X-Nextcloud-Talk-Bot-Signature": talkSignature,
                "OCS-APIRequest": true,
            }
        };

        try {
            let result = await axios.post(url, data, options);

            if (result?.status === 201) {
                return okMsg;
            }

            throw new Error("Nextcloud Talk Error " + (result?.status ?? "Unknown"));
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = NextcloudTalk;
