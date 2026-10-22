const { R } = require("redbean-node");
const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { Settings } = require("../settings");
const { doubleCheckPassword } = require("../better-auth");
const apicache = require("../modules/apicache");
const ConfigTransfer = require("../config-transfer");
const { sendNotificationList } = require("../client");

const server = UptimeKumaServer.getInstance();

/**
 * Check if the socket belongs to an administrator.
 * Users without a role are the legacy single-user / disable auth case and are
 * allowed as well, because there is no user management UI to assign roles yet.
 * @param {Socket} socket Socket.io instance
 * @returns {Promise<void>}
 * @throws {Error} If the user is not logged in or not an administrator
 */
async function checkAdmin(socket) {
    checkLogin(socket);

    const role = socket.session?.user?.role;
    const isAdmin = !role || role === "admin";

    if (!isAdmin && !(await Settings.get("disableAuth"))) {
        throw new Error("Only an administrator can export or import the configuration");
    }
}

/**
 * Start a monitor if it is active.
 * Mirrors startMonitor() from server.js, which cannot be imported here due to
 * circular dependencies.
 * @param {number} monitorID Monitor ID
 * @returns {Promise<void>}
 */
async function startActiveMonitor(monitorID) {
    const monitor = await R.findOne("monitor", " id = ? ", [monitorID]);

    if (!monitor || !monitor.active) {
        return;
    }

    if (monitor.id in server.monitorList) {
        await server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    await monitor.start(server.io);
}

/**
 * Start all imported monitors. A single broken monitor should not fail the
 * whole import, so errors are reported as warnings instead.
 * @param {number[]} monitorIDs Imported monitor IDs
 * @param {string[]} warnings Warning list to append to
 * @returns {Promise<void>}
 */
async function startImportedMonitors(monitorIDs, warnings) {
    for (const monitorID of monitorIDs) {
        try {
            await startActiveMonitor(monitorID);
        } catch (e) {
            log.error("monitor", `Cannot start imported monitor ${monitorID}: ${e.message}`);
            warnings.push(`Monitor ${monitorID} could not be started: ${e.message}`);
        }
    }
}

/**
 * Start all active monitors from the database. Used to restore the previous
 * state if an import failed in replace mode.
 * @returns {Promise<void>}
 */
async function startAllActiveMonitors() {
    const list = await R.find("monitor", " active = 1 ");

    for (const monitor of list) {
        try {
            server.monitorList[monitor.id] = monitor;
            await monitor.start(server.io);
        } catch (e) {
            log.error("monitor", `Cannot restart monitor ${monitor.id}: ${e.message}`);
        }
    }
}

/**
 * Handlers to export/import all monitors and notifications
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.configSocketHandler = (socket) => {
    socket.on("exportConfig", async (callback) => {
        try {
            await checkAdmin(socket);

            const data = await ConfigTransfer.exportConfig();

            log.info(
                "config",
                `Exported ${data.monitors.length} monitors and ${data.notifications.length} notifications`
            );

            callback({
                ok: true,
                data,
            });
        } catch (e) {
            log.error("config", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("importConfig", async (payload, options, callback) => {
        try {
            await checkAdmin(socket);

            const mode = options?.mode === "replace" ? "replace" : "merge";

            // Validate the file before stopping monitors, so an invalid file
            // cannot interrupt the running checks in replace mode.
            ConfigTransfer.validatePayload(payload);

            let stoppedForReplace = false;

            if (mode === "replace") {
                // Deleting monitors is destructive, so ask for the password again.
                if (!(await Settings.get("disableAuth"))) {
                    await doubleCheckPassword(socket.request.headers.cookie, options?.currentPassword);
                }

                // Stop running monitors before their rows are deleted.
                for (const monitorID in server.monitorList) {
                    try {
                        await server.monitorList[monitorID].stop();
                    } catch (e) {
                        log.error("monitor", `Cannot stop monitor ${monitorID}: ${e.message}`);
                    }
                    delete server.monitorList[monitorID];
                }
                stoppedForReplace = true;
            }

            let result;
            try {
                result = await ConfigTransfer.importConfig(payload, {
                    userID: socket.userID,
                    mode,
                });

                await startImportedMonitors(result.importedMonitorIDs, result.warnings);
            } catch (e) {
                // The transaction was rolled back, bring the old monitors back up.
                if (stoppedForReplace) {
                    await startAllActiveMonitors();
                }
                throw e;
            }

            apicache.clear();

            await server.sendMonitorList(socket);
            await sendNotificationList(socket);

            callback({
                ok: true,
                msg: "successImported",
                msgi18n: true,
                data: result,
            });
        } catch (e) {
            log.error("config", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
