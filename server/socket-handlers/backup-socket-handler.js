const compareVersions = require("compare-versions");

const { log } = require("../../src/util");
const { checkLogin } = require("../util-server");
const { Notification } = require("../notification");
const { R } = require("redbean-node");
const StatusPage = require("../model/status_page");
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
                monitorList: await Promise.all(Object.entries(server.monitorList).map(async ([ id, monitor ], index) => {
                    return await monitor.toJSON();
                })),
                statusPageList: await Promise.all((await StatusPage.getStatusPageList()).map(async (statusPage) => {
                    return await StatusPage.getStatusPageData(statusPage);
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

            let notificationListData = backupData.notificationList;
            let proxyListData = backupData.proxyList;
            let monitorListData = backupData.monitorList;

            let version17x = compareVersions.compare(backupData.version, "1.7.0", ">=");

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
            }

            // Only starts importing if the backup file contains at least one notification
            if (notificationListData.length >= 1) {
                // Get every existing notification name and puts them in one simple string
                let notificationNameList = await R.getAll("SELECT name FROM notification");
                let notificationNameListString = JSON.stringify(notificationNameList);

                for (let i = 0; i < notificationListData.length; i++) {
                    // Only starts importing the notification if the import option is "overwrite", "keep" or "skip" but the notification doesn't exists
                    if ((importHandle === "skip" && notificationNameListString.includes(notificationListData[i].name) === false) || importHandle === "keep" || importHandle === "overwrite") {

                        let notification = JSON.parse(notificationListData[i].config);
                        await Notification.save(notification, null, socket.userID);

                    }
                }
            }

            // Only starts importing if the backup file contains at least one proxy
            if (proxyListData && proxyListData.length >= 1) {
                const proxies = await R.findAll("proxy");

                // Loop over proxy list and save proxies
                for (const proxy of proxyListData) {
                    const exists = proxies.find(item => item.id === proxy.id);

                    // Do not process when proxy already exists in import handle is skip and keep
                    if ([ "skip", "keep" ].includes(importHandle) && !exists) {
                        return;
                    }

                    // Save proxy as new entry if exists update exists one
                    await Proxy.save(proxy, exists ? proxy.id : undefined, proxy.userId);
                }
            }

            // Only starts importing if the backup file contains at least one monitor
            if (monitorListData.length >= 1) {
                // Get every existing monitor name and puts them in one simple string
                let monitorNameList = await R.getAll("SELECT name FROM monitor");
                let monitorNameListString = JSON.stringify(monitorNameList);

                for (let i = 0; i < monitorListData.length; i++) {
                    // Only starts importing the monitor if the import option is "overwrite", "keep" or "skip" but the notification doesn't exists
                    if ((importHandle === "skip" && monitorNameListString.includes(monitorListData[i].name) === false) || importHandle === "keep" || importHandle === "overwrite") {

                        // Define in here every new variable for monitors which where implemented after the first version of the Import/Export function (1.6.0)
                        // --- Start ---

                        // Define default values
                        let retryInterval = 0;

                        /*
                        Only replace the default value with the backup file data for the specific version, where it appears the first time
                        More information about that where "let version" will be defined
                        */
                        if (version17x) {
                            retryInterval = monitorListData[i].retryInterval;
                        }

                        // --- End ---

                        let monitor = {
                            // Define the new variable from earlier here
                            name: monitorListData[i].name,
                            type: monitorListData[i].type,
                            url: monitorListData[i].url,
                            method: monitorListData[i].method || "GET",
                            body: monitorListData[i].body,
                            headers: monitorListData[i].headers,
                            authMethod: monitorListData[i].authMethod,
                            basic_auth_user: monitorListData[i].basic_auth_user,
                            basic_auth_pass: monitorListData[i].basic_auth_pass,
                            authWorkstation: monitorListData[i].authWorkstation,
                            authDomain: monitorListData[i].authDomain,
                            interval: monitorListData[i].interval,
                            retryInterval: retryInterval,
                            resendInterval: monitorListData[i].resendInterval || 0,
                            hostname: monitorListData[i].hostname,
                            maxretries: monitorListData[i].maxretries,
                            port: monitorListData[i].port,
                            keyword: monitorListData[i].keyword,
                            ignoreTls: monitorListData[i].ignoreTls,
                            upsideDown: monitorListData[i].upsideDown,
                            maxredirects: monitorListData[i].maxredirects,
                            accepted_statuscodes: monitorListData[i].accepted_statuscodes,
                            dns_resolve_type: monitorListData[i].dns_resolve_type,
                            dns_resolve_server: monitorListData[i].dns_resolve_server,
                            notificationIDList: {},
                            proxy_id: monitorListData[i].proxy_id || null,
                        };

                        if (monitorListData[i].pushToken) {
                            monitor.pushToken = monitorListData[i].pushToken;
                        }

                        let bean = R.dispense("monitor");

                        let notificationIDList = monitor.notificationIDList;
                        delete monitor.notificationIDList;

                        monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                        delete monitor.accepted_statuscodes;

                        bean.import(monitor);
                        bean.user_id = socket.userID;
                        await R.store(bean);

                        // Only for backup files with the version 1.7.0 or higher, since there was the tag feature implemented
                        if (version17x) {
                            // Only import if the specific monitor has tags assigned
                            for (const oldTag of monitorListData[i].tags) {

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

                        await server.updateMonitorNotification(bean.id, notificationIDList);

                        // If monitor was active start it immediately, otherwise pause it
                        if (monitorListData[i].active === 1) {
                            await server.startMonitor(socket.userID, bean.id);
                        } else {
                            await server.pauseMonitor(socket.userID, bean.id);
                        }

                    }
                }

                await server.sendNotificationList(socket);
                await server.sendMonitorList(socket);
            }

            callback({
                ok: true,
                msg: "Backup successfully restored.",
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

};
