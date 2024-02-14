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
        const payload = heartbeatJSON || {};

        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            payload["url"] = baseURL + getMonitorRelativeURL(monitorJSON.id);
        }

        try {
            if (!heartbeatJSON) {
                // Testing or general notification like certificate expiry
                payload["msg"] = msg;
                return this.postNotification(notification, "alert", payload);
            }

            if (heartbeatJSON.status === DOWN) {
                return this.postNotification(notification, "alert", payload);
            }

            if (heartbeatJSON.status === UP) {
                return this.postNotification(notification, "resolve", payload);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

    /**
     * Post to Heii On-Call
     * @param {BeanModel} notification Message title
     * @param {string} action Trigger action (alert, resovle)
     * @param {object} payload Data for Heii On-Call
     * @returns {Promise<string>} Success message
     */
    async postNotification(notification, action, payload) {
        const config = {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: "Bearer " + notification.heiiOnCallApiKey,
            },
        };

        // Post to Heii On-Call Trigger https://heiioncall.com/docs#manual-triggers
        await axios.post(
            `https://heiioncall.com/triggers/${notification.heiiOnCallTriggerId}/${action}`,
            payload,
            config
        );

        return "Sent Successfully";
    }
}

module.exports = HeiiOnCall;
