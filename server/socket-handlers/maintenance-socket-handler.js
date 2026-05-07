const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { getKnex } = require("../db");
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const Maintenance = require("../model/maintenance");
const server = UptimeKumaServer.getInstance();

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.maintenanceSocketHandler = (socket) => {
    // Add a new maintenance
    socket.on("addMaintenance", async (maintenance, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", maintenance);

            let bean = await Maintenance.jsonToBean(new Maintenance(), maintenance);
            bean.user_id = socket.userID;

            const insertPayload = {
                title: bean.title,
                description: bean.description,
                user_id: bean.user_id,
                strategy: bean.strategy,
                interval_day: bean.interval_day,
                timezone: bean.timezone,
                active: bean.active,
                start_date: bean.start_date,
                end_date: bean.end_date,
                start_time: bean.start_time,
                end_time: bean.end_time,
                weekdays: bean.weekdays,
                days_of_month: bean.days_of_month,
                cron: bean.cron,
                duration: bean.duration,
            };

            const inserted = await Maintenance.query().insertAndFetch(insertPayload);
            // Reuse the in-memory bean (with beanMeta etc.) but adopt the assigned id.
            bean.id = inserted.id;
            const maintenanceID = bean.id;

            server.maintenanceList[maintenanceID] = bean;
            await bean.run(true);

            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
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

            let bean = server.getMaintenance(maintenance.id);

            if (bean.user_id !== socket.userID) {
                throw new Error("Permission denied.");
            }

            await Maintenance.jsonToBean(bean, maintenance);

            const payload = {
                title: bean.title,
                description: bean.description,
                strategy: bean.strategy,
                interval_day: bean.interval_day,
                timezone: bean.timezone,
                active: bean.active,
                start_date: bean.start_date,
                end_date: bean.end_date,
                start_time: bean.start_time,
                end_time: bean.end_time,
                weekdays: bean.weekdays,
                days_of_month: bean.days_of_month,
                cron: bean.cron,
                duration: bean.duration,
            };

            await Maintenance.query().patchAndFetchById(bean.id, payload);
            await bean.run(true);
            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                maintenanceID: bean.id,
            });
        } catch (e) {
            log.error("maintenance", e);
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

            const knex = getKnex();
            await knex("monitor_maintenance").where("maintenance_id", maintenanceID).delete();

            for await (const monitor of monitors) {
                await knex("monitor_maintenance").insert({
                    monitor_id: monitor.id,
                    maintenance_id: maintenanceID,
                });
            }

            apicache.clear();

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
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

            const knex = getKnex();
            await knex("maintenance_status_page").where("maintenance_id", maintenanceID).delete();

            for await (const statusPage of statusPages) {
                await knex("maintenance_status_page").insert({
                    status_page_id: statusPage.id,
                    maintenance_id: maintenanceID,
                });
            }

            apicache.clear();

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
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

            let bean = await Maintenance.query().where({ id: maintenanceID,
                user_id: socket.userID }).first();

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
            log.error("maintenance", e);
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

            const monitors = await getKnex()("monitor_maintenance as mm")
                .join("monitor", "mm.monitor_id", "monitor.id")
                .where("mm.maintenance_id", maintenanceID)
                .select("monitor.id");

            callback({
                ok: true,
                monitors,
            });
        } catch (e) {
            log.error("maintenance", e);
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

            const statusPages = await getKnex()("maintenance_status_page as msp")
                .join("status_page", "msp.status_page_id", "status_page.id")
                .where("msp.maintenance_id", maintenanceID)
                .select("status_page.id", "status_page.title");

            callback({
                ok: true,
                statusPages,
            });
        } catch (e) {
            log.error("maintenance", e);
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
                server.maintenanceList[maintenanceID].stop();
                delete server.maintenanceList[maintenanceID];
            }

            await getKnex()("maintenance").where({ id: maintenanceID,
                user_id: socket.userID }).delete();

            apicache.clear();

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
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

            let maintenance = server.getMaintenance(maintenanceID);

            if (!maintenance) {
                throw new Error("Maintenance not found");
            }

            maintenance.active = false;
            await maintenance.$query().patch({ active: false });
            maintenance.stop();

            apicache.clear();

            callback({
                ok: true,
                msg: "successPaused",
                msgi18n: true,
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

            let maintenance = server.getMaintenance(maintenanceID);

            if (!maintenance) {
                throw new Error("Maintenance not found");
            }

            maintenance.active = true;
            await maintenance.$query().patch({ active: true });
            await maintenance.run();

            apicache.clear();

            callback({
                ok: true,
                msg: "successResumed",
                msgi18n: true,
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
