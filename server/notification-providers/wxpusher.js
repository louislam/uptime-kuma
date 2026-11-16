const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class WxPusher extends NotificationProvider {
    name = "WxPusher";

    // WxPusher's simple-push accepts at most 10 SPTs per request.
    static SPT_PER_REQUEST = 10;

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        // Accept one or multiple SPTs, comma-separated.
        const sptList = String(notification.wxpusherSPT || "")
            .split(",")
            .map((spt) => spt.trim())
            .filter((spt) => spt.length > 0);

        try {
            if (sptList.length === 0) {
                throw new Error("No WxPusher SPT is configured");
            }

            const summary = this.checkStatus(heartbeatJSON, monitorJSON).slice(0, 100);
            const config = this.getAxiosConfigWithProxy({});

            // Send in batches so more than 10 SPTs are all delivered, never silently dropped.
            for (let i = 0; i < sptList.length; i += WxPusher.SPT_PER_REQUEST) {
                const context = {
                    content: msg,
                    summary,
                    contentType: 1,
                    sptList: sptList.slice(i, i + WxPusher.SPT_PER_REQUEST),
                };
                const result = await axios.post(
                    "https://wxpusher.zjiecode.com/api/send/message/simple-push",
                    context,
                    config
                );
                if (result.data.code !== 1000) {
                    throw result.data.msg;
                }
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Get the formatted title for message
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} Formatted title
     */
    checkStatus(heartbeatJSON, monitorJSON) {
        let title = "UptimeKuma Message";
        if (heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            title = "UptimeKuma Monitor Up " + monitorJSON["name"];
        }
        if (heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            title = "UptimeKuma Monitor Down " + monitorJSON["name"];
        }
        return title;
    }
}

module.exports = WxPusher;
