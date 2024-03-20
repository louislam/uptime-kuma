const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");

const NotificationProvider = require("./notification-provider");
const axios = require("axios");
class HeiiOnCall extends NotificationProvider {
    name = "HeiiOnCall";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const payload = heartbeatJSON || {};

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            payload["url"] = baseURL + getMonitorRelativeURL(monitorJSON.id);
        }

        const config = {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: "Bearer " + notification.heiiOnCallApiKey,
            },
        };
        const heiiUrl = `https://heiioncall.com/triggers/${notification.heiiOnCallTriggerId}/`;
        // docs https://heiioncall.com/docs#manual-triggers
        try {
            if (!heartbeatJSON) {
                // Testing or general notification like certificate expiry
                payload["msg"] = msg;
                await axios.post(heiiUrl + "alert", payload, config);
                return okMsg;
            }

            if (heartbeatJSON.status === DOWN) {
                await axios.post(heiiUrl + "alert", payload, config);
                return okMsg;
            }
            if (heartbeatJSON.status === UP) {
                await axios.post(heiiUrl + "resolve", payload, config);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = HeiiOnCall;
