const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const dayjs = require("dayjs");
const server = UptimeKumaServer.getInstance();

/**
 * Handlers for Monitor Silence (alert acknowledgment)
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.silenceSocketHandler = (socket) => {
    // Silence a monitor: suppress notifications while keeping checks running
    socket.on("silenceMonitor", async (monitorID, message, callback) => {
        try {
            checkLogin(socket);

            if (!message || !message.trim()) {
                throw new Error("A reason is required to silence a monitor.");
            }

            let monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, socket.userID]);
            if (!monitor) {
                throw new Error("Monitor not found");
            }

            const lastBeatCheck = await R.getRow(
                "SELECT status FROM heartbeat WHERE monitor_id = ? ORDER BY time DESC LIMIT 1",
                [monitorID]
            );
            if (!lastBeatCheck || lastBeatCheck.status !== 0) {
                throw new Error("Only a DOWN monitor can be silenced.");
            }

            monitor.silenced = true;
            monitor.silence_message = message.trim();
            monitor.silenced_at = R.isoDateTimeMillis(dayjs.utc());
            monitor.silenced_by = socket.userID;
            await R.store(monitor);

            // Update the live in-memory instance so the beat loop sees the change immediately
            const liveMonitor = server.monitorList[monitorID];
            if (liveMonitor) {
                liveMonitor.silenced = true;
                liveMonitor.silence_message = monitor.silence_message;
                liveMonitor.silenced_at = monitor.silenced_at;
                liveMonitor.silenced_by = monitor.silenced_by;
            }

            log.info("silence", `Monitor #${monitorID} silenced by user ${socket.userID}: ${message}`);

            // Insert a permanent log entry in the heartbeat table
            const now = R.isoDateTimeMillis(dayjs.utc());
            const currentStatus = lastBeatCheck.status;
            const logMsg = message ? `Silenced: ${message}` : "Silenced";

            await R.exec(
                "INSERT INTO heartbeat (monitor_id, status, time, msg, important, duration, down_count) VALUES (?, ?, ?, ?, 1, 0, 0)",
                [monitorID, currentStatus, now, logMsg]
            );

            // Emit heartbeat to frontend with type:"silence" to skip toast
            server.io.to(socket.userID).emit("heartbeat", {
                monitorID,
                status: currentStatus,
                time: now,
                msg: logMsg,
                important: true,
                duration: 0,
                type: "silence",
            });

            await server.sendUpdateMonitorIntoList(socket, monitorID);

            callback({
                ok: true,
                msg: "successSilenced",
                msgi18n: true,
            });
        } catch (e) {
            log.error("silence", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Unsilence a monitor: resume normal notification behavior
    socket.on("unsilenceMonitor", async (monitorID, callback) => {
        try {
            checkLogin(socket);

            let monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, socket.userID]);
            if (!monitor) {
                throw new Error("Monitor not found");
            }

            monitor.silenced = false;
            monitor.silence_message = null;
            monitor.silenced_at = null;
            monitor.silenced_by = null;
            await R.store(monitor);

            // Update the live in-memory instance so the beat loop sees the change immediately
            const liveMonitor = server.monitorList[monitorID];
            if (liveMonitor) {
                liveMonitor.silenced = false;
                liveMonitor.silence_message = null;
                liveMonitor.silenced_at = null;
                liveMonitor.silenced_by = null;
            }

            log.info("silence", `Monitor #${monitorID} unsilenced by user ${socket.userID}`);

            await server.sendUpdateMonitorIntoList(socket, monitorID);

            callback({
                ok: true,
                msg: "successUnsilenced",
                msgi18n: true,
            });
        } catch (e) {
            log.error("silence", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
