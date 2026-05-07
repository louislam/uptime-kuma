const { checkLogin } = require("../util-server");
const { Notification } = require("../notification");
const { sendNotificationList } = require("../client");
const { socketError } = require("../utils/socket-error");

/**
 * Handlers for notification configuration and testing.
 * Extracted from server/server.js as part of the H-1 monolith breakup.
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.notificationSocketHandler = (socket) => {
    // Add or Edit
    socket.on("addNotification", async (notification, notificationID, callback) => {
        try {
            checkLogin(socket);

            let notificationBean = await Notification.save(notification, notificationID, socket.userID);
            await sendNotificationList(socket);

            callback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: notificationBean.id,
            });
        } catch (e) {
            socketError(callback, e, "Failed to save notification");
        }
    });

    socket.on("deleteNotification", async (notificationID, callback) => {
        try {
            checkLogin(socket);

            await Notification.delete(notificationID, socket.userID);
            await sendNotificationList(socket);

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });
        } catch (e) {
            socketError(callback, e, "Failed to delete notification");
        }
    });

    socket.on("testNotification", async (notification, callback) => {
        try {
            checkLogin(socket);

            let msg = await Notification.send(notification, notification.name + " Testing");

            callback({
                ok: true,
                msg,
            });
        } catch (e) {
            socketError(callback, e, "Failed to send test notification");
        }
    });

    socket.on("checkApprise", async (callback) => {
        try {
            checkLogin(socket);
            callback(await Notification.checkApprise());
        } catch (e) {
            callback(false);
        }
    });
};
