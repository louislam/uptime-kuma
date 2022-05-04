class NotificationProvider {

    /**
     * Notification Provider Name
     * @type string
     */
    name = undefined;

    /**
     * Send a notification
     * @param {BeanModel} notification
     * @param {string} msg General Message
     * @param {?Object} monitorJSON Monitor details (For Up/Down only)
     * @param {?Object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Return Successful Message
     * @throws Error with fail msg
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        throw new Error("Have to override Notification.send(...)");
    }

    /**
     * Throws an error
     * @param {any} error The error to throw
     * @throws {any} The error specified
     */
    throwGeneralAxiosError(error) {
        let msg = "Error: " + error + " ";

        if (error.response && error.response.data) {
            if (typeof error.response.data === "string") {
                msg += error.response.data;
            } else {
                msg += JSON.stringify(error.response.data);
            }
        }

        throw new Error(msg);
    }
}

module.exports = NotificationProvider;
