class NotificationProvider {

    /**
     * Notification Provider Name
     * @type {string}
     */
    name = undefined;

    /**
     * Send a notification
     * @param {BeanModel} notification Notification to send
     * @param {string} msg General Message
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Return Successful Message
     * @throws Error with fail msg
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        throw new Error("Have to override Notification.send(...)");
    }

    /**
     * Extracts the address from a monitor JSON object based on its type.
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} The extracted address based on the monitor type.
     */
    extractAdress(monitorJSON) {
        if (!monitorJSON) {
            return "";
        }
        switch (monitorJSON["type"]) {
            case "push":
                return "Heartbeat";
            case "ping":
                return monitorJSON["hostname"];
            case "port":
            case "dns":
            case "gamedig":
            case "steam":
                if (monitorJSON["port"]) {
                    return monitorJSON["hostname"] + ":" + monitorJSON["port"];
                }
                return monitorJSON["hostname"];
            default:
                if (![ "https://", "http://", "" ].includes(monitorJSON["url"])) {
                    return monitorJSON["url"];
                }
                return "";
        }
    }

    /**
     * Throws an error
     * @param {any} error The error to throw
     * @returns {void}
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
