const { R } = require("redbean-node");
const { log } = require("../src/util");
const { loadPlugins } = require("./utils/plugin-loader");
const path = require("path");
const { commandExists } = require("./util-server");
const NotificationProvider = require("./notification-providers/notification-provider");

class Notification {
    providerList = {};

    /**
     * Initialize the notification providers
     * @returns {void}
     * @throws {Error} If a notification provider is missing a name
     * @throws {Error} If duplicate notification provider names are found
     */
    static init() {
        log.debug("notification", "Prepare Notification Providers");

        this.providerList = {};

        loadPlugins(path.join(__dirname, "notification-providers"), NotificationProvider, (instance, filename) => {
            if (!instance.name) {
                throw new Error(`Notification provider in file "${filename}" missing 'name' property`);
            }

            if (this.providerList[instance.name]) {
                throw new Error(`Duplicate notification provider name "${instance.name}" in file "${filename}"`);
            }
            this.providerList[instance.name] = instance;
        });
    }

    /**
     * Send a notification
     * @param {BeanModel} notification Notification to send
     * @param {string} msg General Message
     * @param {object} monitorJSON Monitor details (For Up/Down only)
     * @param {object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Successful msg
     * @throws {Error} If the notification type is unsupported or sending fails
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (this.providerList[notification.type]) {
            return this.providerList[notification.type].send(notification, msg, monitorJSON, heartbeatJSON);
        } else {
            throw new Error("Notification type is not supported");
        }
    }

    /**
     * Save a notification
     * @param {object} notification Notification to save
     * @param {?number} notificationID ID of notification to update
     * @param {number} userID ID of user who adds notification
     * @returns {Promise<Bean>} Notification that was saved
     */
    static async save(notification, notificationID, userID) {
        let bean;

        if (notificationID) {
            bean = await R.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

            if (!bean) {
                throw new Error("notification not found");
            }
        } else {
            bean = R.dispense("notification");
        }

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification);
        bean.is_default = notification.isDefault || false;
        await R.store(bean);

        if (notification.applyExisting) {
            await applyNotificationEveryMonitor(bean.id, userID);
        }

        return bean;
    }

    /**
     * Delete a notification
     * @param {number} notificationID ID of notification to delete
     * @param {number} userID ID of user who created notification
     * @returns {Promise<void>}
     */
    static async delete(notificationID, userID) {
        let bean = await R.findOne("notification", " id = ? AND user_id = ? ", [notificationID, userID]);

        if (!bean) {
            throw new Error("notification not found");
        }

        await R.trash(bean);
    }

    /**
     * Check if apprise exists
     * @returns {Promise<boolean>} Does the command apprise exist?
     */
    static async checkApprise() {
        return await commandExists("apprise");
    }
}

/**
 * Apply the notification to every monitor
 * @param {number} notificationID ID of notification to apply
 * @param {number} userID ID of user who created notification
 * @returns {Promise<void>}
 */
async function applyNotificationEveryMonitor(notificationID, userID) {
    let monitors = await R.getAll("SELECT id FROM monitor WHERE user_id = ?", [userID]);

    for (let i = 0; i < monitors.length; i++) {
        let checkNotification = await R.findOne("monitor_notification", " monitor_id = ? AND notification_id = ? ", [
            monitors[i].id,
            notificationID,
        ]);

        if (!checkNotification) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitors[i].id;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

module.exports = {
    Notification,
};
