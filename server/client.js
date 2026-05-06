/*
 * For Client Socket
 */
const { TimeLogger } = require("../src/util");
const { getKnex } = require("./db");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const APIKey = require("./model/api_key");
const DockerHostModel = require("./model/docker_host");
const ProxyModel = require("./model/proxy");
const RemoteBrowserModel = require("./model/remote_browser");
const server = UptimeKumaServer.getInstance();
const io = server.io;
const { setting } = require("./util-server");
const checkVersion = require("./check-version");
const Database = require("./database");

/**
 * Send list of notification providers to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<object[]>} List of notifications
 */
async function sendNotificationList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await getKnex()("notification").where("user_id", socket.userID);

    for (let row of list) {
        const notificationObject = { ...row };
        notificationObject.isDefault = Boolean(notificationObject.is_default);
        notificationObject.active = Boolean(notificationObject.active);
        result.push(notificationObject);
    }

    io.to(socket.userID).emit("notificationList", result);

    timeLogger.print("Send Notification List");

    return list;
}

/**
 * Send Heartbeat History list to socket
 * @param {Socket} socket Socket.io instance
 * @param {number} monitorID ID of monitor to send heartbeat history
 * @param {boolean} toUser  True = send to all browsers with the same user id, False = send to the current browser only
 * @param {boolean} overwrite Overwrite client-side's heartbeat list
 * @returns {Promise<void>}
 */
async function sendHeartbeatList(socket, monitorID, toUser = false, overwrite = false) {
    let list = await getKnex()("heartbeat")
        .where("monitor_id", monitorID)
        .orderBy("time", "desc")
        .limit(100);

    let result = list.reverse();

    if (toUser) {
        io.to(socket.userID).emit("heartbeatList", monitorID, result, overwrite);
    } else {
        socket.emit("heartbeatList", monitorID, result, overwrite);
    }
}

/**
 * Important Heart beat list (aka event list)
 * @param {Socket} socket Socket.io instance
 * @param {number} monitorID ID of monitor to send heartbeat history
 * @param {boolean} toUser  True = send to all browsers with the same user id, False = send to the current browser only
 * @param {boolean} overwrite Overwrite client-side's heartbeat list
 * @returns {Promise<void>}
 */
async function sendImportantHeartbeatList(socket, monitorID, toUser = false, overwrite = false) {
    const timeLogger = new TimeLogger();

    const Heartbeat = require("./model/heartbeat");
    let list = await Heartbeat.query()
        .where({ monitor_id: monitorID,
            important: true })
        .orderBy("time", "desc")
        .limit(500);

    timeLogger.print(`[Monitor: ${monitorID}] sendImportantHeartbeatList`);

    const result = list.map((bean) => bean.toJSON());

    if (toUser) {
        io.to(socket.userID).emit("importantHeartbeatList", monitorID, result, overwrite);
    } else {
        socket.emit("importantHeartbeatList", monitorID, result, overwrite);
    }
}

/**
 * Emit proxy list to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<import("./model/proxy")[]>} List of proxies
 */
async function sendProxyList(socket) {
    const timeLogger = new TimeLogger();

    const list = await ProxyModel.query().where("user_id", socket.userID);
    io.to(socket.userID).emit(
        "proxyList",
        list.map((bean) => ({ ...bean }))
    );

    timeLogger.print("Send Proxy List");

    return list;
}

/**
 * Emit API key list to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<void>}
 */
async function sendAPIKeyList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    const list = await APIKey.query().where("user_id", socket.userID);

    for (let bean of list) {
        result.push(bean.toPublicJSON());
    }

    io.to(socket.userID).emit("apiKeyList", result);
    timeLogger.print("Sent API Key List");

    return list;
}

/**
 * Emits the version information to the client.
 * @param {Socket} socket Socket.io socket instance
 * @param {boolean} hideVersion Should we hide the version information in the response?
 * @returns {Promise<void>}
 */
async function sendInfo(socket, hideVersion = false) {
    const info = {
        primaryBaseURL: await setting("primaryBaseURL"),
        serverTimezone: await server.getTimezone(),
        serverTimezoneOffset: server.getTimezoneOffset(),
    };
    if (!hideVersion) {
        info.version = checkVersion.version;
        info.latestVersion = checkVersion.latestVersion;
        info.isContainer = process.env.UPTIME_KUMA_IS_CONTAINER === "1";
        info.dbType = Database.dbConfig.type;
        info.runtime = {
            platform: process.platform, // linux or win32
            arch: process.arch, // x86 or arm
        };
    }

    socket.emit("info", info);
}

/**
 * Send list of docker hosts to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<import("./model/docker_host")[]>} List of docker hosts
 */
async function sendDockerHostList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await DockerHostModel.query().where("user_id", socket.userID);

    for (let bean of list) {
        result.push(bean.toJSON());
    }

    io.to(socket.userID).emit("dockerHostList", result);

    timeLogger.print("Send Docker Host List");

    return list;
}

/**
 * Send list of remote browsers to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<import("./model/remote_browser")[]>} List of remote browsers
 */
async function sendRemoteBrowserList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await RemoteBrowserModel.query().where("user_id", socket.userID);

    for (let bean of list) {
        result.push(bean.toJSON());
    }

    io.to(socket.userID).emit("remoteBrowserList", result);

    timeLogger.print("Send Remote Browser List");

    return list;
}

/**
 * Send list of monitor types to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<void>}
 */
async function sendMonitorTypeList(socket) {
    const result = Object.entries(UptimeKumaServer.monitorTypeList).map(([key, type]) => {
        return [
            key,
            {
                supportsConditions: type.supportsConditions,
                conditionVariables: type.conditionVariables.map((v) => {
                    return {
                        id: v.id,
                        operators: v.operators.map((o) => {
                            return {
                                id: o.id,
                                caption: o.caption,
                            };
                        }),
                    };
                }),
            },
        ];
    });

    io.to(socket.userID).emit("monitorTypeList", Object.fromEntries(result));
}

module.exports = {
    sendNotificationList,
    sendImportantHeartbeatList,
    sendHeartbeatList,
    sendProxyList,
    sendAPIKeyList,
    sendInfo,
    sendDockerHostList,
    sendRemoteBrowserList,
    sendMonitorTypeList,
};
