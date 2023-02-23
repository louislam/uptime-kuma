const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const Maintenance = require("../model/maintenance");
const server = UptimeKumaServer.getInstance();
const MaintenanceTimeslot = require("../model/maintenance_timeslot");

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 */
module.exports.maintenanceSocketHandler = (socket) => {
    // Add a new maintenance
    socket.on("addMaintenance", async (maintenance, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", maintenance);

            let bean = Maintenance.jsonToBean(R.dispense("maintenance"), maintenance);
            bean.user_id = socket.userID;
            let maintenanceID = await R.store(bean);
            await MaintenanceTimeslot.generateTimeslot(bean);

            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "Added Successfully.",
                maintenanceID,
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Edit a maintenance
    socket.on("editMaintenance", async (maintenance, callback) => {
        try {
            checkLogin(socket);

            let bean = await R.findOne("maintenance", " id = ? ", [ maintenance.id ]);

            if (bean.user_id !== socket.userID) {
                throw new Error("Permission denied.");
            }

            Maintenance.jsonToBean(bean, maintenance);

            await R.store(bean);
            await MaintenanceTimeslot.generateTimeslot(bean, null, true);

            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "Saved.",
                maintenanceID: bean.id,
            });

        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new monitor_maintenance
    socket.on("addMonitorMaintenance", async (maintenanceID, monitors, callback) => {
        try {
            checkLogin(socket);

            await R.exec("DELETE FROM monitor_maintenance WHERE maintenance_id = ?", [
                maintenanceID
            ]);

            for await (const monitor of monitors) {
                let bean = R.dispense("monitor_maintenance");

                bean.import({
                    monitor_id: monitor.id,
                    maintenance_id: maintenanceID
                });
                await R.store(bean);
            }

            apicache.clear();

            callback({
                ok: true,
                msg: "Added Successfully.",
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new monitor_maintenance
    socket.on("addMaintenanceStatusPage", async (maintenanceID, statusPages, callback) => {
        try {
            checkLogin(socket);

            await R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ?", [
                maintenanceID
            ]);

            for await (const statusPage of statusPages) {
                let bean = R.dispense("maintenance_status_page");

                bean.import({
                    status_page_id: statusPage.id,
                    maintenance_id: maintenanceID
                });
                await R.store(bean);
            }

            apicache.clear();

            callback({
                ok: true,
                msg: "Added Successfully.",
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Get Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let bean = await R.findOne("maintenance", " id = ? AND user_id = ? ", [
                maintenanceID,
                socket.userID,
            ]);

            callback({
                ok: true,
                maintenance: await bean.toJSON(),
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenanceList", async (callback) => {
        try {
            checkLogin(socket);
            await server.sendMaintenanceList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMonitorMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Get Monitors for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let monitors = await R.getAll("SELECT monitor.id, monitor.name FROM monitor_maintenance mm JOIN monitor ON mm.monitor_id = monitor.id WHERE mm.maintenance_id = ? ", [
                maintenanceID,
            ]);

            callback({
                ok: true,
                monitors,
            });

        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenanceStatusPage", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Get Status Pages for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let statusPages = await R.getAll("SELECT status_page.id, status_page.title FROM maintenance_status_page msp JOIN status_page ON msp.status_page_id = status_page.id WHERE msp.maintenance_id = ? ", [
                maintenanceID,
            ]);

            callback({
                ok: true,
                statusPages,
            });

        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Delete Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            if (maintenanceID in server.maintenanceList) {
                delete server.maintenanceList[maintenanceID];
            }

            await R.exec("DELETE FROM maintenance WHERE id = ? AND user_id = ? ", [
                maintenanceID,
                socket.userID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Deleted Successfully.",
            });

            await server.sendMaintenanceList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("pauseMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Pause Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            await R.exec("UPDATE maintenance SET active = 0 WHERE id = ? ", [
                maintenanceID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Paused Successfully.",
            });

            await server.sendMaintenanceList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("resumeMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Resume Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            await R.exec("UPDATE maintenance SET active = 1 WHERE id = ? ", [
                maintenanceID,
            ]);

            apicache.clear();

            callback({
                ok: true,
                msg: "Resume Successfully",
            });

            await server.sendMaintenanceList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
