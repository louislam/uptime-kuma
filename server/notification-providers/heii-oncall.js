const { UP, DOWN, getMonitorRelativeURL } = require("../../src/util");
const { setting } = require("../util-server");

const NotificationProvider = require("./notification-provider");
const axios = require("axios");

const heiiOnCallBaseUrl = "http://192.168.2.1:3005";

class HeiiOnCall extends NotificationProvider {
    name = "HeiiOnCall";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        // Payload to Heii On-Call is the entire heartbat JSON
        const payload = heartbeatJSON ? heartbeatJSON : {};

        if (!heartbeatJSON) {
            // Test button was clicked on Notification Setup, trigger the alert as a test
            payload["message"] = "Testing UptimeKuma Trigger";
            return this.postNotification(notification, "alert", payload);
        }

        // If we can add url back to mintor to payload
        const baseURL = await setting("primaryBaseURL");
        if (baseURL && monitorJSON) {
            payload["url"] = baseURL + getMonitorRelativeURL(monitorJSON.id);
        }

        if (heartbeatJSON.status === DOWN) {
            // Monitor is DOWN, alert on Heii On-Call
            return this.postNotification(notification, "alert", payload);
        }

        if (heartbeatJSON.status === UP) {
            // Monitor is UP, resolve on Heii On-Call
            return this.postNotification(notification, "resolve", payload);
        }
    }

    /**
     * Post to Heii On-Call
     * @param {BeanModel} notification Message title
     * @param {string} action Trigger Action (alert, resovle)
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
            `${heiiOnCallBaseUrl}/triggers/${notification.heiiOnCallTriggerId}/${action}`,
            payload,
            config
        );
        return "Sent Successfully.";
    }
}

module.exports = HeiiOnCall;
