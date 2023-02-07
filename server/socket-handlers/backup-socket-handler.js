const { log } = require("../../src/util");
const { checkLogin } = require("../util-server");
const { sendNotificationList, sendProxyList } = require("../client");
const { Notification } = require("../notification");
const { R } = require("redbean-node");
const Monitor = require("../model/monitor");
const Maintenance = require("../model/maintenance");
const { Proxy } = require("../proxy");
const StatusPage = require("../model/status_page");
const Incident = require("../model/incident");
const MaintenanceTimeslot = require("../model/maintenance_timeslot");
const apicache = require("../modules/apicache");
const version = require("../../package.json").version;
const dayjs = require("dayjs");

/**
 * Handlers for JSON backup system
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server server instance
 */
module.exports.backupSocketHandler = (socket, server) => {

    socket.on("downloadBackup", async (callback) => {
        try {
            checkLogin(socket);
            log.debug("backup", `Producing Backup, User ID: ${socket.userID}`);

            const exportData = {
                version: version,
                notificationList: (await Notification.getNotificationList(socket.userID)).map(notification => notification.toJSON()),
                proxyList: (await Proxy.getProxyList(socket.userID)).map(proxy => proxy.toJSON()),
                monitorList: await Promise.all(Object.entries(server.monitorList).map(async ([ id, monitor ], index) => {
                    return await monitor.toJSON();
                })),
                maintenanceList: Object.entries(await server.getMaintenanceJSONList(socket.userID)).map(([ id, maintenance ], index) => {
                    return maintenance;
                }),
                statusPageList: await Promise.all((await StatusPage.getStatusPageList()).map(async (statusPage) => {
                    return await StatusPage.getStatusPageBackup(statusPage);
                })),
            };

            const timestamp = dayjs().format("YYYY_MM_DD-hh_mm_ss");

            callback({
                ok: true,
                msg: "Backup successfully generated.",
                exportData: exportData,
                timestamp: timestamp,
            });
        } catch (e) {
            log.error("backup", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("uploadBackup", async (uploadedJSON, importHandle, callback) => {
        try {
            checkLogin(socket);

            let backupData = JSON.parse(uploadedJSON);

            log.debug("backup", `Importing Backup, User ID: ${socket.userID}, Version: ${backupData.version}`);

            let notificationListData = backupData.notificationList || [];
            let proxyListData = backupData.proxyList || [];
            let monitorListData = backupData.monitorList || [];
            let maintenanceListData = backupData.maintenanceList || [];
            let statusPageListData = backupData.statusPageList || [];

            // Map old IDs to new IDs
            let notificationIDMap = {};
            let proxyIDMap = {};
            let monitorIDMap = {};
            let maintenaceIDMap = {};

            // If the import option is "overwrite" it'll clear most of the tables, except "settings" and "user"
            if (importHandle === "overwrite") {
                // Stops every monitor first, so it doesn't execute any heartbeat while importing
                for (let id in server.monitorList) {
                    let monitor = server.monitorList[id];
                    await monitor.stop();
                }
                await R.exec("DELETE FROM heartbeat");
                await R.exec("DELETE FROM monitor_notification");
                await R.exec("DELETE FROM monitor_tls_info");
                await R.exec("DELETE FROM notification");
                await R.exec("DELETE FROM monitor_tag");
                await R.exec("DELETE FROM tag");
                await R.exec("DELETE FROM monitor");
                await R.exec("DELETE FROM proxy");
                await R.exec("DELETE FROM maintenance");
                await R.exec("DELETE FROM monitor_maintenance");
                await R.exec("DELETE FROM status_page");
                await R.exec("DELETE FROM `group`");

                await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
            }

            // Only starts importing if the backup file contains at least one notification
            if (notificationListData.length >= 1) {
                let notifications = await R.findAll("notification");

                for (const notification of notificationListData) {
                    const exists = notifications.find(item => item.id === notification.id);

                    // Do not process when it already exists and importHandle is skip
                    if (importHandle === "skip" && exists !== undefined) {
                        continue;
                    }

                    let notificationParsed = JSON.parse(notification.config);
                    let bean = await Notification.save(notificationParsed, undefined, notification.userId);

                    notificationIDMap[notification.id] = bean.id;
                }

                // Update notificationID in monitorList
                monitorListData.map((monitor) => {
                    for (let notificationID in monitor.notificationIDList) {
                        if (notificationIDMap[notificationID] !== undefined) {
                            monitor.notificationIDList[notificationIDMap[notificationID]] = true;
                            delete monitor.notificationIDList[notificationID];
                        }
                    }
                });

                await sendNotificationList(socket);
            }

            // Only starts importing if the backup file contains at least one proxy
            if (proxyListData.length >= 1) {
                const proxies = await R.findAll("proxy");

                for (const proxy of proxyListData) {
                    const exists = proxies.find(item => item.id === proxy.id);

                    // Do not process when it already exists and importHandle is skip
                    if (importHandle === "skip" && exists !== undefined) {
                        continue;
                    }

                    // Save proxy as new entry
                    const bean = await Proxy.save(proxy, undefined, proxy.userId);

                    proxyIDMap[proxy.id] = bean.id;
                }

                // Update proxyID in monitorList
                monitorListData.map((monitor) => {
                    monitor.proxyId = monitor.proxyId ? proxyIDMap[monitor.proxyId] ?? monitor.proxyId : null;
                });

                await sendProxyList(socket);
            }

            // Only starts importing if the backup file contains at least one monitor
            if (monitorListData.length >= 1) {
                const monitors = await R.findAll("monitor");

                for (const monitor of monitorListData) {
                    const exists = monitors.find(item => item.id === monitor.id);

                    // Do not process when it already exists and importHandle is skip
                    if (importHandle === "skip" && exists !== undefined) {
                        continue;
                    }

                    let notificationIDList = monitor.notificationIDList;

                    let tagsList = monitor.tags;

                    // Save monitor as new entry
                    const bean = await Monitor.save(monitor, undefined, socket.userID);

                    monitorIDMap[monitor.id] = bean.id;

                    if (Array.isArray(tagsList) && tagsList.length > 0) {
                        // Only import if the specific monitor has tags assigned
                        for (const oldTag of tagsList) {

                            // Check if tag already exists and get data ->
                            let tag = await R.findOne("tag", " name = ?", [
                                oldTag.name,
                            ]);

                            let tagId;
                            if (! tag) {
                                // -> If it doesn't exist, create new tag from backup file
                                let beanTag = R.dispense("tag");
                                beanTag.name = oldTag.name;
                                beanTag.color = oldTag.color;
                                await R.store(beanTag);

                                tagId = beanTag.id;
                            } else {
                                // -> If it already exist, set tagId to value from database
                                tagId = tag.id;
                            }

                            // Assign the new created tag to the monitor
                            await R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)", [
                                tagId,
                                bean.id,
                                oldTag.value,
                            ]);
                        }
                    }

                    // Update monitorID in maintenanceList
                    maintenanceListData.map((maintenance) => {
                        maintenance.monitors = maintenance.monitors?.map((monitorID) => {
                            return monitorIDMap[monitorID] ?? monitorID;
                        });
                    });

                    await Monitor.updateMonitorNotification(bean.id, notificationIDList);

                    // If monitor was active start it immediately, otherwise pause it
                    if (monitor.active === 1) {
                        await bean.start(server.io);
                    } else {
                        await bean.stop();
                    }
                }

                await server.sendMonitorList(socket);
            }

            // Only starts importing if the backup file contains at least one maintenance
            if (maintenanceListData.length >= 1) {
                const maintenances = await R.findAll("maintenance");

                for (const maintenance of maintenanceListData) {
                    const exists = maintenances.find(item => item.id === maintenance.id);

                    // Do not process when it already exists and importHandle is skip
                    if (importHandle === "skip" && exists !== undefined) {
                        continue;
                    }

                    // Save maintenance as new entry
                    const bean = await Maintenance.save(maintenance, undefined, socket.userID);

                    maintenaceIDMap[maintenance.id] = bean.id;

                    // Assign monitors to maintenance
                    if (Array.isArray(maintenance.monitors) && maintenance.monitors.length > 0) {
                        for (const monitorId of maintenance.monitors) {
                            let monitorMaintenance = R.dispense("monitor_maintenance");

                            monitorMaintenance.import({
                                monitor_id: monitorId,
                                maintenance_id: bean.id
                            });

                            await R.store(monitorMaintenance);
                        }
                    }

                    await MaintenanceTimeslot.generateTimeslot(bean, null, true);
                }

                await server.sendMaintenanceList(socket);
            }

            // Only starts importing if the backup file contains at least one status page
            if (statusPageListData.length >= 1) {
                const statusPages = await R.findAll("status_page");

                for (const statusPage of statusPageListData) {
                    const exists = statusPages.find(item => item.id === statusPage.id);

                    // Do not process when it already exists and importHandle is skip
                    if (importHandle === "skip" && exists !== undefined) {
                        continue;
                    }

                    // Save status page as new entry
                    const bean = await StatusPage.create(statusPage.config?.title, statusPage.config?.slug);

                    statusPage.groupList.map((group) => {
                        delete group.id;
                        group.monitorList.map((monitor) => {
                            monitor.id = monitorIDMap[monitor.id];
                        });
                    });

                    await StatusPage.save(statusPage.config?.slug, statusPage.config, statusPage.config?.icon, statusPage.groupList);

                    if (statusPage.incidents != null) {
                        for (const incident of statusPage.incidents) {
                            delete incident.id;
                            await Incident.save(statusPage.config?.slug, incident);
                        }
                    }

                    if (statusPage.maintenanceList != null) {
                        for (const maintenance of statusPage.maintenanceList) {
                            await Maintenance.addMaintenanceStatusPage(maintenaceIDMap[maintenance.id], bean.id);
                        }
                    }
                }

                await StatusPage.sendStatusPageList(server.io, socket);
            }

            apicache.clear();

            callback({
                ok: true,
                msg: "Backup successfully restored.",
            });

        } catch (e) {
            log.error("backup", e);
            await R.exec("PRAGMA foreign_keys = on");
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

};
