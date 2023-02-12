//
//  bark.js
//  UptimeKuma
//
//  Created by Lakr Aream on 2021/10/24.
//  Copyright © 2021 Lakr Aream. All rights reserved.
//

const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");

// bark is an APN bridge that sends notifications to Apple devices.

const barkNotificationAvatar = "https://github.com/louislam/uptime-kuma/raw/master/public/icon.png";
const successMessage = "Successes!";

class Bark extends NotificationProvider {
    name = "Bark";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let barkEndpoint = notification.barkEndpoint;

        // check if the endpoint has a "/" suffix, if so, delete it first
        if (barkEndpoint.endsWith("/")) {
            barkEndpoint = barkEndpoint.substring(0, barkEndpoint.length - 1);
        }

        if (msg != null && heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            let title = "UptimeKuma Monitor Up";
            return await this.postNotification(notification, title, msg, barkEndpoint);
        }

        if (msg != null && heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            let title = "UptimeKuma Monitor Down";
            return await this.postNotification(notification, title, msg, barkEndpoint);
        }

        if (msg != null) {
            let title = "UptimeKuma Message";
            return await this.postNotification(notification, title, msg, barkEndpoint);
        }
    }

    /**
     * Check if result is successful
     * @param {Object} result Axios response object
     * @throws {Error} The status code is not in range 2xx
     */
    checkResult(result) {
        if (result.status == null) {
            throw new Error("Bark notification failed with invalid response!");
        }
        if (result.status < 200 || result.status >= 300) {
            throw new Error("Bark notification failed with status code " + result.status);
        }
    }

    /**
     * Send the message
     * @param {string} title Message title
     * @param {string} subtitle Message
     * @param {string} endpoint Endpoint to send request to
     * @returns {string}
     */
    async postNotification(notification, title, subtitle, endpoint) {
        let result = await axios.post(`${endpoint}/push`, {
            title,
            body: subtitle,
            icon: barkNotificationAvatar,
            sound: notification.barkSound || "telegraph", // default sound is telegraph
            group: notification.barkGroup || "UptimeKuma", // default group is UptimeKuma
        });
        this.checkResult(result);
        if (result.statusText != null) {
            return "Bark notification succeed: " + result.statusText;
        }
        // because returned in range 200 ..< 300
        return successMessage;
    }
}

module.exports = Bark;
