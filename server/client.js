/*
 * For Client Socket
 */
const { TimeLogger } = require("../src/util");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = server.io;
const { setting } = require("./util-server");
const checkVersion = require("./check-version");
const Database = require("./database");

/**
 * Send list of notification providers to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<Bean[]>} List of notifications
 */
async function sendNotificationList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await R.find("notification", " user_id = ? ", [socket.userID]);

    for (let bean of list) {
        let notificationObject = bean.export();
        notificationObject.isDefault = notificationObject.isDefault === 1;
        notificationObject.active = notificationObject.active === 1;
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
    let list = await R.getAll(
        `
        SELECT * FROM heartbeat
        WHERE monitor_id = ?
        ORDER BY time DESC
        LIMIT 100
    `,
        [monitorID]
    );

    let result = list.reverse();

    if (toUser) {
        io.to(socket.userID).emit("heartbeatList", monitorID, result, overwrite);
    } else {
        socket.emit("heartbeatList", monitorID, result, overwrite);
    }
}

/**
 * 批量发送每个 monitor 的最新一条心跳，用于状态速览顶部统计数字的快速渲染。
 * 单次 SQL 取所有 monitor 的最新心跳，避免 N 次 sendHeartbeatList 调用和 N 个 emit 事件。
 * @param {Socket} socket Socket.io 实例
 * @param {object} monitorList 监控项列表（key 为 monitorID）
 * @param {boolean} toUser True=推送给同用户所有浏览器，False=仅推送给当前浏览器
 * @returns {Promise<void>}
 */
async function sendLastHeartbeatBatch(socket, monitorList, toUser = false) {
    const monitorIDs = Object.keys(monitorList);
    if (monitorIDs.length === 0) {
        return;
    }

    // 单条 SQL 取所有 monitor 的最新心跳，避免 N 次 DB 查询
    const placeholders = monitorIDs.map(() => "?").join(",");
    const list = await R.getAll(
        `
        SELECT h.* FROM heartbeat h
        INNER JOIN (
            SELECT monitor_id, MAX(time) AS max_time
            FROM heartbeat
            WHERE monitor_id IN (${placeholders})
            GROUP BY monitor_id
        ) latest ON h.monitor_id = latest.monitor_id AND h.time = latest.max_time
    `,
        monitorIDs
    );

    // 按 monitorID 组织为 { [id]: [beat] } 形式，与 heartbeatList 数据结构一致（数组）
    const batch = {};
    for (const beat of list) {
        batch[beat.monitor_id] = [beat];
    }

    if (toUser) {
        io.to(socket.userID).emit("lastHeartbeatBatch", batch);
    } else {
        socket.emit("lastHeartbeatBatch", batch);
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

    let list = await R.find(
        "heartbeat",
        `
        monitor_id = ?
        AND important = 1
        ORDER BY time DESC
        LIMIT 500
    `,
        [monitorID]
    );

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
 * @returns {Promise<Bean[]>} List of proxies
 */
async function sendProxyList(socket) {
    const timeLogger = new TimeLogger();

    const list = await R.find("proxy", " user_id = ? ", [socket.userID]);
    io.to(socket.userID).emit(
        "proxyList",
        list.map((bean) => bean.export())
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
    const list = await R.find("api_key", "user_id=?", [socket.userID]);

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
 * @returns {Promise<Bean[]>} List of docker hosts
 */
async function sendDockerHostList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await R.find("docker_host", " user_id = ? ", [socket.userID]);

    for (let bean of list) {
        result.push(bean.toJSON());
    }

    io.to(socket.userID).emit("dockerHostList", result);

    timeLogger.print("Send Docker Host List");

    return list;
}

/**
 * Send list of docker hosts to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<Bean[]>} List of docker hosts
 */
async function sendRemoteBrowserList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await R.find("remote_browser", " user_id = ? ", [socket.userID]);

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
    sendLastHeartbeatBatch,
    sendProxyList,
    sendAPIKeyList,
    sendInfo,
    sendDockerHostList,
    sendRemoteBrowserList,
    sendMonitorTypeList,
};
