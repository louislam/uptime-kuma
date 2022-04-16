class NotificationProvider {

    /**
     * Notification Provider Name
     * @type string
     */
    name = undefined;

    /**
     * @param notification : BeanModel
     * @param msg : string General Message
     * @param monitorJSON : object Monitor details (For Up/Down only)
     * @param heartbeatJSON : object Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Return Successful Message
     * Throw Error with fail msg
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        throw new Error("Have to override Notification.send(...)");
    }

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
