/*
 * For Client Socket
 */
const { TimeLogger } = require("../src/util");
const { R } = require("redbean-node");
const { UptimeKumaServer, getInfo } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = server.io;

/**
 * Send list of notification providers to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<Bean[]>} List of notifications
 */
async function sendNotificationList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await R.find("notification");

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
 * Send the latest heartbeat of many monitors in one event.
 * The full 100-beat history is fetched lazily per visible row, so the login
 * payload does not grow with the number of monitors.
 * @param {Socket} socket Socket.io instance
 * @param {Array<number|string>} monitorIDs Monitor ids
 * @returns {Promise<void>}
 */
async function sendHeartbeatLists(socket, monitorIDs) {
    const result = {};
    const chunkSize = 500;

    for (let i = 0; i < monitorIDs.length; i += chunkSize) {
        const chunk = monitorIDs.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => "?").join(",");
        const rows = await R.getAll(
            `
            SELECT h.id, h.monitor_id, h.status, h.msg, h.time, h.ping, h.important, h.duration, h.down_count, h.retries
            FROM heartbeat h
            JOIN (
                SELECT monitor_id, MAX(id) AS max_id
                FROM heartbeat
                WHERE monitor_id IN (${placeholders})
                GROUP BY monitor_id
            ) latest ON h.id = latest.max_id
        `,
            chunk
        );
        for (const row of rows) {
            result[row.monitor_id] = [row];
        }
    }

    socket.emit("heartbeatLists", result);
}

/**
 * Recent heartbeat history for one monitor, requested by a visible row
 * @param {number} monitorID Monitor id
 * @returns {Promise<Array<object>>} Oldest-to-newest heartbeats
 */
async function getHeartbeatHistory(monitorID) {
    const list = await R.getAll(
        `
        SELECT id, monitor_id, status, msg, time, ping, important, duration, down_count, retries
        FROM heartbeat
        WHERE monitor_id = ?
        ORDER BY time DESC
        LIMIT 100
    `,
        [monitorID]
    );
    return list.reverse();
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

    const list = await R.find("proxy");
    io.to(socket.userID).emit(
        "proxyList",
        list.map((bean) => bean.export())
    );

    timeLogger.print("Send Proxy List");

    return list;
}

/**
 * Emits the version information to the client.
 * @param {Socket} socket Socket.io socket instance
 * @param {boolean} hideVersion Should we hide the version information in the response?
 * @returns {Promise<void>}
 */
async function sendInfo(socket, hideVersion = false) {
    socket.emit("info", await getInfo(hideVersion));
}

/**
 * Send list of docker hosts to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<Bean[]>} List of docker hosts
 */
async function sendDockerHostList(socket) {
    const timeLogger = new TimeLogger();

    let result = [];
    let list = await R.find("docker_host");

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
    let list = await R.find("remote_browser");

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
    sendHeartbeatLists,
    getHeartbeatHistory,
    sendProxyList,

    getInfo,
    sendInfo,
    sendDockerHostList,
    sendRemoteBrowserList,
    sendMonitorTypeList,
};
