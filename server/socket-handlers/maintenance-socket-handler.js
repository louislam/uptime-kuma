const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const Maintenance = require("../model/maintenance");
const server = UptimeKumaServer.getInstance();

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 */
module.exports.maintenanceSocketHandler = (socket) => {

    // Add a new maintenance
    socket.on("addMaintenance", async (maintenance, callback) => {

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenance)", maintenance);

            let bean = await Maintenance.jsonToBean(R.dispense("maintenance"), maintenance);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenance)",
            `R.dispense("maintenance")`);
            bean.user_id = socket.userID;
            let maintenanceID = await R.store(bean);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenance)",
            `R.store(bean)`);

            server.maintenanceList[maintenanceID] = bean;
            await bean.run(true);

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(editMaintenance)","");

        try {
            checkLogin(socket);

            let bean = server.getMaintenance(maintenance.id);

            if (bean.user_id !== socket.userID) {
                throw new Error("Permission denied.");
            }

            await Maintenance.jsonToBean(bean, maintenance);
            await R.store(bean);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenance)",
            `R.store(bean)`);
            await bean.run(true);
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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)","");

        try {
            checkLogin(socket);

            await R.exec("DELETE FROM monitor_maintenance WHERE maintenance_id = ?", [
                maintenanceID
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
            `R.exec("DELETE FROM monitor_maintenance WHERE maintenance_id = ${maintenanceID}"`);

            for await (const monitor of monitors) {
                let bean = R.dispense("monitor_maintenance");
                log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
                `R.dispense("monitor_maintenance")`);

                bean.import({
                    monitor_id: monitor.id,
                    maintenance_id: maintenanceID
                });
                await R.store(bean);
                log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
                `R.store(bean)`);
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

      log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMaintenanceStatusPage)","");

        try {
            checkLogin(socket);

            await R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ?", [
                maintenanceID
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
            `R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ${maintenanceID}"`);

            for await (const statusPage of statusPages) {
                let bean = R.dispense("maintenance_status_page");
                log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
                `R.dispense("maintenance_status_page")`);

                bean.import({
                    status_page_id: statusPage.id,
                    maintenance_id: maintenanceID
                });
                await R.store(bean);
                log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(addMonitorMaintenance)",
                `R.store(bean)`);
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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenance)", `Get Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let bean = await R.findOne("maintenance", " id = ? AND user_id = ? ", [
                maintenanceID,
                socket.userID,
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenance)",
            `R.findOne("maintenance", " id = ${maintenanceID} AND user_id = ${socket.userID} ")`);

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenanceList)","");

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMonitorMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMonitorMaintenance)", `Get Monitors for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let monitors = await R.getAll("SELECT monitor.id, monitor.name FROM monitor_maintenance mm JOIN monitor ON mm.monitor_id = monitor.id WHERE mm.maintenance_id = ? ", [
                maintenanceID,
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMonitorMaintenance)",
            `R.getAll("SELECT monitor.id, monitor.name FROM monitor_maintenance mm JOIN monitor ON mm.monitor_id = monitor.id WHERE mm.maintenance_id = ${maintenanceID} ")`);

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenanceStatusPage)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenanceStatusPage)", `Get Status Pages for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let statusPages = await R.getAll("SELECT status_page.id, status_page.title FROM maintenance_status_page msp JOIN status_page ON msp.status_page_id = status_page.id WHERE msp.maintenance_id = ? ", [
                maintenanceID,
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(getMaintenanceStatusPage)",
            ` R.getAll("SELECT status_page.id, status_page.title FROM maintenance_status_page msp JOIN status_page ON msp.status_page_id = status_page.id WHERE msp.maintenance_id = ${maintenanceID} ")`);

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(deleteMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(deleteMaintenance)", `Delete Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            if (maintenanceID in server.maintenanceList) {
                server.maintenanceList[maintenanceID].stop();
                delete server.maintenanceList[maintenanceID];
            }

            await R.exec("DELETE FROM maintenance WHERE id = ? AND user_id = ? ", [
                maintenanceID,
                socket.userID,
            ]);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(deleteMaintenance)",
            `R.exec("DELETE FROM maintenance WHERE id = ${maintenanceID} AND user_id = ${socket.userID} "`);

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(pauseMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(pauseMaintenance)", `Pause Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let maintenance = server.getMaintenance(maintenanceID);

            if (!maintenance) {
                throw new Error("Maintenance not found");
            }

            maintenance.active = false;
            await R.store(maintenance);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(pauseMaintenance)",
            `R.store(maintenance)`);
            maintenance.stop();

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

        log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(resumeMaintenance)","");

        try {
            checkLogin(socket);

            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(resumeMaintenance)", `Resume Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let maintenance = server.getMaintenance(maintenanceID);

            if (!maintenance) {
                throw new Error("Maintenance not found");
            }

            maintenance.active = true;
            await R.store(maintenance);
            log.debug("server/socket-handlers/maintenance-socket-handler.js/maintenanceSocketHandler(socket)/socket.on(resumeMaintenance)",
            `R.store(maintenance)`);
            await maintenance.run();

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
