console.log("Welcome to Uptime Kuma");

if (! process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

console.log("Node Env: " + process.env.NODE_ENV);

const { sleep, debug, TimeLogger, getRandomInt } = require("../src/util");

console.log("Importing Node libraries")
const fs = require("fs");
const http = require("http");
const https = require("https");

console.log("Importing 3rd-party libraries")
debug("Importing express");
const express = require("express");
debug("Importing socket.io");
const { Server } = require("socket.io");
debug("Importing redbean-node");
const { R } = require("redbean-node");
debug("Importing jsonwebtoken");
const jwt = require("jsonwebtoken");
debug("Importing http-graceful-shutdown");
const gracefulShutdown = require("http-graceful-shutdown");
debug("Importing prometheus-api-metrics");
const prometheusAPIMetrics = require("prometheus-api-metrics");

debug("Importing 2FA Modules");
const notp = require("notp");
const base32 = require("thirty-two");

console.log("Importing this project modules");
debug("Importing Monitor");
const Monitor = require("./model/monitor");
debug("Importing Settings");
const { getSettings, setSettings, setting, initJWTSecret, genSecret, allowDevAllOrigin } = require("./util-server");

debug("Importing Notification");
const { Notification } = require("./notification");
Notification.init();

debug("Importing Database");
const Database = require("./database");

const { basicAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const args = require("args-parser")(process.argv);

const checkVersion = require("./check-version");
console.info("Version: " + checkVersion.version);

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
const hostname = process.env.HOST || args.host;
const port = parseInt(process.env.PORT || args.port || 3001);

// SSL
const sslKey = process.env.SSL_KEY || args["ssl-key"] || undefined;
const sslCert = process.env.SSL_CERT || args["ssl-cert"] || undefined;

// Data Directory (must be end with "/")
Database.dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";
Database.path = Database.dataDir + "kuma.db";
if (! fs.existsSync(Database.dataDir)) {
    fs.mkdirSync(Database.dataDir, { recursive: true });
}
console.log(`Data Dir: ${Database.dataDir}`);

console.log("Creating express and socket.io instance")
const app = express();

let server;

if (sslKey && sslCert) {
    console.log("Server Type: HTTPS");
    server = https.createServer({
        key: fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert)
    }, app);
} else {
    console.log("Server Type: HTTP");
    server = http.createServer(app);
}

const io = new Server(server);
module.exports.io = io;

// Must be after io instantiation
const { sendNotificationList, sendHeartbeatList, sendImportantHeartbeatList } = require("./client");

app.use(express.json());

/**
 * Total WebSocket client connected to server currently, no actual use
 * @type {number}
 */
let totalClient = 0;

/**
 * Use for decode the auth object
 * @type {null}
 */
let jwtSecret = null;

/**
 * Main monitor list
 * @type {{}}
 */
let monitorList = {};

/**
 * Show Setup Page
 * @type {boolean}
 */
let needSetup = false;

/**
 * Cache Index HTML
 * @type {string}
 */
let indexHTML = fs.readFileSync("./dist/index.html").toString();

exports.entryPage = "dashboard";

(async () => {
    await initDatabase();

    exports.entryPage = await setting("entryPage");

    console.log("Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Robots.txt
    app.get("/robots.txt", async (_request, response) => {
        let txt = "User-agent: *\nDisallow:";
        if (! await setting("searchEngineIndex")) {
            txt += " /";
        }
        response.setHeader("Content-Type", "text/plain");
        response.send(txt);
    });

    // Basic Auth Router here

    // Prometheus API metrics  /metrics
    // With Basic Auth using the first user's username/password
    app.get("/metrics", basicAuth, prometheusAPIMetrics());

    app.use("/", express.static("dist"));

    app.get("/.well-known/change-password", async (_, response) => {
        response.redirect("https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI");
    });

    // API Router
    const apiRouter = require("./routers/api-router");
    app.use(apiRouter);

    // Universal Route Handler, must be at the end of all express route.
    app.get("*", async (_request, response) => {
        response.send(indexHTML);
    });

    console.log("Adding socket handler")
    io.on("connection", async (socket) => {

        socket.emit("info", {
            version: checkVersion.version,
            latestVersion: checkVersion.latestVersion,
        })

        totalClient++;

        if (needSetup) {
            console.log("Redirect to setup page")
            socket.emit("setup")
        }

        socket.on("disconnect", () => {
            totalClient--;
        });

        // ***************************
        // Public Socket API
        // ***************************

        socket.on("loginByToken", async (token, callback) => {

            try {
                let decoded = jwt.verify(token, jwtSecret);

                console.log("Username from JWT: " + decoded.username)

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ])

                if (user) {
                    debug("afterLogin")

                    afterLogin(socket, user)

                    debug("afterLogin ok")

                    callback({
                        ok: true,
                    })
                } else {
                    callback({
                        ok: false,
                        msg: "The user is inactive or deleted.",
                    })
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Invalid token.",
                })
            }

        });

        socket.on("login", async (data, callback) => {
            console.log("Login")

            let user = await login(data.username, data.password)

            if (user) {
                afterLogin(socket, user)

                if (user.twofaStatus == 0) {
                    callback({
                        ok: true,
                        token: jwt.sign({
                            username: data.username,
                        }, jwtSecret),
                    })
                }

                if (user.twofaStatus == 1 && !data.token) {
                    callback({
                        tokenRequired: true,
                    })
                }

                if (data.token) {
                    let verify = notp.totp.verify(data.token, user.twofa_secret);

                    if (verify && verify.delta == 0) {
                        callback({
                            ok: true,
                            token: jwt.sign({
                                username: data.username,
                            }, jwtSecret),
                        })
                    } else {
                        callback({
                            ok: false,
                            msg: "Invalid Token!",
                        })
                    }
                }
            } else {
                callback({
                    ok: false,
                    msg: "Incorrect username or password.",
                })
            }

        });

        socket.on("logout", async (callback) => {
            socket.leave(socket.userID)
            socket.userID = null;
            callback();
        });

        socket.on("prepare2FA", async (callback) => {
            try {
                checkLogin(socket)

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ])

                if (user.twofa_status == 0) {
                    let newSecret = await genSecret()
                    let encodedSecret = base32.encode(newSecret);
                    let uri = `otpauth://totp/Uptime%20Kuma:${user.username}?secret=${encodedSecret}`;

                    await R.exec("UPDATE `user` SET twofa_secret = ? WHERE id = ? ", [
                        newSecret,
                        socket.userID,
                    ]);

                    callback({
                        ok: true,
                        uri: uri,
                    })
                } else {
                    callback({
                        ok: false,
                        msg: "2FA is already enabled.",
                    })
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to prepare 2FA.",
                })
            }
        });

        socket.on("save2FA", async (callback) => {
            try {
                checkLogin(socket)

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [
                    socket.userID,
                ]);

                callback({
                    ok: true,
                    msg: "2FA Enabled.",
                })
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to change 2FA.",
                })
            }
        });

        socket.on("disable2FA", async (callback) => {
            try {
                checkLogin(socket)

                await R.exec("UPDATE `user` SET twofa_status = 0 WHERE id = ? ", [
                    socket.userID,
                ]);

                callback({
                    ok: true,
                    msg: "2FA Disabled.",
                })
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to change 2FA.",
                })
            }
        });

        socket.on("verifyToken", async (token, callback) => {
            let user = await R.findOne("user", " id = ? AND active = 1 ", [
                socket.userID,
            ])

            let verify = notp.totp.verify(token, user.twofa_secret);

            if (verify && verify.delta == 0) {
                callback({
                    ok: true,
                    valid: true,
                })
            } else {
                callback({
                    ok: false,
                    msg: "Invalid Token.",
                    valid: false,
                })
            }
        });

        socket.on("twoFAStatus", async (callback) => {
            checkLogin(socket)

            try {
                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ])

                if (user.twofa_status == 1) {
                    callback({
                        ok: true,
                        status: true,
                    })
                } else {
                    callback({
                        ok: true,
                        status: false,
                    })
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to get 2FA status.",
                })
            }
        });

        socket.on("needSetup", async (callback) => {
            callback(needSetup);
        });

        socket.on("setup", async (username, password, callback) => {
            try {
                if ((await R.count("user")) !== 0) {
                    throw new Error("Uptime Kuma has been setup. If you want to setup again, please delete the database.")
                }

                let user = R.dispense("user")
                user.username = username;
                user.password = passwordHash.generate(password)
                await R.store(user)

                needSetup = false;

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

        // ***************************
        // Auth Only API
        // ***************************

        // Add a new monitor
        socket.on("add", async (monitor, callback) => {
            try {
                checkLogin(socket)
                let bean = R.dispense("monitor")

                let notificationIDList = monitor.notificationIDList;
                delete monitor.notificationIDList;

                monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                delete monitor.accepted_statuscodes;

                bean.import(monitor)
                bean.user_id = socket.userID
                await R.store(bean)

                await updateMonitorNotification(bean.id, notificationIDList)

                await startMonitor(socket.userID, bean.id);
                await sendMonitorList(socket);

                callback({
                    ok: true,
                    msg: "Added Successfully.",
                    monitorID: bean.id,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Edit a monitor
        socket.on("editMonitor", async (monitor, callback) => {
            try {
                checkLogin(socket)

                let bean = await R.findOne("monitor", " id = ? ", [ monitor.id ])

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.")
                }

                bean.name = monitor.name
                bean.type = monitor.type
                bean.url = monitor.url
                bean.interval = monitor.interval
                bean.retryInterval = monitor.retryInterval;
                bean.hostname = monitor.hostname;
                bean.maxretries = monitor.maxretries;
                bean.port = monitor.port;
                bean.keyword = monitor.keyword;
                bean.ignoreTls = monitor.ignoreTls;
                bean.upsideDown = monitor.upsideDown;
                bean.maxredirects = monitor.maxredirects;
                bean.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                bean.dns_resolve_type = monitor.dns_resolve_type;
                bean.dns_resolve_server = monitor.dns_resolve_server;

                await R.store(bean)

                await updateMonitorNotification(bean.id, monitor.notificationIDList)

                if (bean.active) {
                    await restartMonitor(socket.userID, bean.id)
                }

                await sendMonitorList(socket);

                callback({
                    ok: true,
                    msg: "Saved.",
                    monitorID: bean.id,
                });

            } catch (e) {
                console.error(e)
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitorList", async (callback) => {
            try {
                checkLogin(socket)
                await sendMonitorList(socket);
                callback({
                    ok: true,
                });
            } catch (e) {
                console.error(e)
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket)

                console.log(`Get Monitor: ${monitorID} User ID: ${socket.userID}`)

                let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ])

                callback({
                    ok: true,
                    monitor: await bean.toJSON(),
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Start or Resume the monitor
        socket.on("resumeMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket)
                await startMonitor(socket.userID, monitorID);
                await sendMonitorList(socket);

                callback({
                    ok: true,
                    msg: "Resumed Successfully.",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("pauseMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket)
                await pauseMonitor(socket.userID, monitorID)
                await sendMonitorList(socket);

                callback({
                    ok: true,
                    msg: "Paused Successfully.",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket)

                console.log(`Delete Monitor: ${monitorID} User ID: ${socket.userID}`)

                if (monitorID in monitorList) {
                    monitorList[monitorID].stop();
                    delete monitorList[monitorID]
                }

                await R.exec("DELETE FROM monitor WHERE id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);

                callback({
                    ok: true,
                    msg: "Deleted Successfully.",
                });

                await sendMonitorList(socket);

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getTags", async (callback) => {
            try {
                checkLogin(socket)

                const list = await R.findAll("tag")

                callback({
                    ok: true,
                    tags: list.map(bean => bean.toJSON()),
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("addTag", async (tag, callback) => {
            try {
                checkLogin(socket)

                let bean = R.dispense("tag")
                bean.name = tag.name
                bean.color = tag.color
                await R.store(bean)

                callback({
                    ok: true,
                    tag: await bean.toJSON(),
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("editTag", async (tag, callback) => {
            try {
                checkLogin(socket)

                let bean = await R.findOne("monitor", " id = ? ", [ tag.id ])
                bean.name = tag.name
                bean.color = tag.color
                await R.store(bean)

                callback({
                    ok: true,
                    tag: await bean.toJSON(),
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteTag", async (tagID, callback) => {
            try {
                checkLogin(socket)

                await R.exec("DELETE FROM tag WHERE id = ? ", [ tagID ])

                callback({
                    ok: true,
                    msg: "Deleted Successfully.",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("addMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket)

                await R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)", [
                    tagID,
                    monitorID,
                    value,
                ])

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

        socket.on("editMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket)

                await R.exec("UPDATE monitor_tag SET value = ? WHERE tag_id = ? AND monitor_id = ?", [
                    value,
                    tagID,
                    monitorID,
                ])

                callback({
                    ok: true,
                    msg: "Edited Successfully.",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteMonitorTag", async (tagID, monitorID, value, callback) => {
            try {
                checkLogin(socket)

                await R.exec("DELETE FROM monitor_tag WHERE tag_id = ? AND monitor_id = ? AND value = ?", [
                    tagID,
                    monitorID,
                    value,
                ])

                // Cleanup unused Tags
                await R.exec("delete from tag where ( select count(*) from monitor_tag mt where tag.id = mt.tag_id ) = 0");

                callback({
                    ok: true,
                    msg: "Deleted Successfully.",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("changePassword", async (password, callback) => {
            try {
                checkLogin(socket)

                if (! password.currentPassword) {
                    throw new Error("Invalid new password")
                }

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ])

                if (user && passwordHash.verify(password.currentPassword, user.password)) {

                    user.resetPassword(password.newPassword);

                    callback({
                        ok: true,
                        msg: "Password has been updated successfully.",
                    })
                } else {
                    throw new Error("Incorrect current password")
                }

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getSettings", async (callback) => {
            try {
                checkLogin(socket)

                callback({
                    ok: true,
                    data: await getSettings("general"),
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("setSettings", async (data, callback) => {
            try {
                checkLogin(socket)

                await setSettings("general", data);
                exports.entryPage = data.entryPage;

                callback({
                    ok: true,
                    msg: "Saved"
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Add or Edit
        socket.on("addNotification", async (notification, notificationID, callback) => {
            try {
                checkLogin(socket)

                let notificationBean = await Notification.save(notification, notificationID, socket.userID)
                await sendNotificationList(socket)

                callback({
                    ok: true,
                    msg: "Saved",
                    id: notificationBean.id,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("deleteNotification", async (notificationID, callback) => {
            try {
                checkLogin(socket)

                await Notification.delete(notificationID, socket.userID)
                await sendNotificationList(socket)

                callback({
                    ok: true,
                    msg: "Deleted",
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("testNotification", async (notification, callback) => {
            try {
                checkLogin(socket)

                let msg = await Notification.send(notification, notification.name + " Testing")

                callback({
                    ok: true,
                    msg,
                });

            } catch (e) {
                console.error(e)

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("checkApprise", async (callback) => {
            try {
                checkLogin(socket)
                callback(Notification.checkApprise());
            } catch (e) {
                callback(false);
            }
        });

        socket.on("uploadBackup", async (uploadedJSON, importHandle, callback) => {
            try {
                checkLogin(socket)

                let backupData = JSON.parse(uploadedJSON);

                console.log(`Importing Backup, User ID: ${socket.userID}, Version: ${backupData.version}`)

                let notificationListData = backupData.notificationList;
                let monitorListData = backupData.monitorList;

                if (importHandle == "overwrite") {
                    for (let id in monitorList) {
                        let monitor = monitorList[id]
                        await monitor.stop()
                    }
                    await R.exec("DELETE FROM heartbeat");
                    await R.exec("DELETE FROM monitor_notification");
                    await R.exec("DELETE FROM monitor_tls_info");
                    await R.exec("DELETE FROM notification");
                    await R.exec("DELETE FROM monitor");
                }

                if (notificationListData.length >= 1) {
                    let notificationNameList = await R.getAll("SELECT name FROM notification");
                    let notificationNameListString = JSON.stringify(notificationNameList);

                    for (let i = 0; i < notificationListData.length; i++) {
                        if ((importHandle == "skip" && notificationNameListString.includes(notificationListData[i].name) == false) || importHandle == "keep" || importHandle == "overwrite") {

                            let notification = JSON.parse(notificationListData[i].config);
                            await Notification.save(notification, null, socket.userID)

                        }
                    }
                }

                if (monitorListData.length >= 1) {
                    let monitorNameList = await R.getAll("SELECT name FROM monitor");
                    let monitorNameListString = JSON.stringify(monitorNameList);

                    for (let i = 0; i < monitorListData.length; i++) {
                        if ((importHandle == "skip" && monitorNameListString.includes(monitorListData[i].name) == false) || importHandle == "keep" || importHandle == "overwrite") {

                            let monitor = {
                                name: monitorListData[i].name,
                                type: monitorListData[i].type,
                                url: monitorListData[i].url,
                                interval: monitorListData[i].interval,
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
                            }

                            let bean = R.dispense("monitor")

                            let notificationIDList = monitor.notificationIDList;
                            delete monitor.notificationIDList;

                            monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                            delete monitor.accepted_statuscodes;

                            bean.import(monitor)
                            bean.user_id = socket.userID
                            await R.store(bean)

                            await updateMonitorNotification(bean.id, notificationIDList)

                            if (monitorListData[i].active == 1) {
                                await startMonitor(socket.userID, bean.id);
                            } else {
                                await pauseMonitor(socket.userID, bean.id);
                            }

                        }
                    }

                    await sendNotificationList(socket)
                    await sendMonitorList(socket);
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

        socket.on("clearEvents", async (monitorID, callback) => {
            try {
                checkLogin(socket)

                console.log(`Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`)

                await R.exec("UPDATE heartbeat SET msg = ?, important = ? WHERE monitor_id = ? ", [
                    "",
                    "0",
                    monitorID,
                ]);

                await sendImportantHeartbeatList(socket, monitorID, true, true);

                callback({
                    ok: true,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("clearHeartbeats", async (monitorID, callback) => {
            try {
                checkLogin(socket)

                console.log(`Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`)

                await R.exec("DELETE FROM heartbeat WHERE monitor_id = ?", [
                    monitorID
                ]);

                await sendHeartbeatList(socket, monitorID, true, true);

                callback({
                    ok: true,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("clearStatistics", async (callback) => {
            try {
                checkLogin(socket)

                console.log(`Clear Statistics User ID: ${socket.userID}`)

                await R.exec("DELETE FROM heartbeat");

                callback({
                    ok: true,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        debug("added all socket handlers")

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        debug("check auto login")
        if (await setting("disableAuth")) {
            console.log("Disabled Auth: auto login to admin")
            afterLogin(socket, await R.findOne("user"))
            socket.emit("autoLogin")
        } else {
            debug("need auth")
        }

    });

    console.log("Init the server")

    server.once("error", async (err) => {
        console.error("Cannot listen: " + err.message);
        await Database.close();
    });

    server.listen(port, hostname, () => {
        if (hostname) {
            console.log(`Listening on ${hostname}:${port}`);
        } else {
            console.log(`Listening on ${port}`);
        }
        startMonitors();
        checkVersion.startInterval();
    });

})();

async function updateMonitorNotification(monitorID, notificationIDList) {
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [
        monitorID,
    ])

    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation)
        }
    }
}

async function checkOwner(userID, monitorID) {
    let row = await R.getRow("SELECT id FROM monitor WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ])

    if (! row) {
        throw new Error("You do not own this monitor.");
    }
}

async function sendMonitorList(socket) {
    let list = await getMonitorJSONList(socket.userID);
    io.to(socket.userID).emit("monitorList", list)
    return list;
}

async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id)

    let monitorList = await sendMonitorList(socket)
    sendNotificationList(socket)

    await sleep(500);

    for (let monitorID in monitorList) {
        await sendHeartbeatList(socket, monitorID);
    }

    for (let monitorID in monitorList) {
        await sendImportantHeartbeatList(socket, monitorID);
    }

    for (let monitorID in monitorList) {
        await Monitor.sendStats(io, monitorID, user.id)
    }
}

async function getMonitorJSONList(userID) {
    let result = {};

    let monitorList = await R.find("monitor", " user_id = ? ORDER BY weight DESC, name", [
        userID,
    ])

    for (let monitor of monitorList) {
        result[monitor.id] = await monitor.toJSON();
    }

    return result;
}

function checkLogin(socket) {
    if (! socket.userID) {
        throw new Error("You are not logged in.");
    }
}

async function initDatabase() {
    if (! fs.existsSync(Database.path)) {
        console.log("Copying Database")
        fs.copyFileSync(Database.templatePath, Database.path);
    }

    console.log("Connecting to Database")
    await Database.connect();
    console.log("Connected")

    // Patch the database
    await Database.patch()

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (! jwtSecretBean) {
        console.log("JWT secret is not found, generate one.");
        jwtSecretBean = await initJWTSecret();
        console.log("Stored JWT secret into database");
    } else {
        console.log("Load JWT secret from database.");
    }

    // If there is no record in user table, it is a new Uptime Kuma instance, need to setup
    if ((await R.count("user")) === 0) {
        console.log("No user, need setup")
        needSetup = true;
    }

    jwtSecret = jwtSecretBean.value;
}

async function startMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID)

    console.log(`Resume Monitor: ${monitorID} User ID: ${userID}`)

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    let monitor = await R.findOne("monitor", " id = ? ", [
        monitorID,
    ])

    if (monitor.id in monitorList) {
        monitorList[monitor.id].stop();
    }

    monitorList[monitor.id] = monitor;
    monitor.start(io)
}

async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID)
}

async function pauseMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID)

    console.log(`Pause Monitor: ${monitorID} User ID: ${userID}`)

    await R.exec("UPDATE monitor SET active = 0 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    if (monitorID in monitorList) {
        monitorList[monitorID].stop();
    }
}

/**
 * Resume active monitors
 */
async function startMonitors() {
    let list = await R.find("monitor", " active = 1 ")

    for (let monitor of list) {
        monitorList[monitor.id] = monitor;
    }

    for (let monitor of list) {
        monitor.start(io);
        // Give some delays, so all monitors won't make request at the same moment when just start the server.
        await sleep(getRandomInt(300, 1000));
    }
}

async function shutdownFunction(signal) {
    console.log("Shutdown requested");
    console.log("Called signal: " + signal);

    console.log("Stopping all monitors")
    for (let id in monitorList) {
        let monitor = monitorList[id]
        monitor.stop()
    }
    await sleep(2000);
    await Database.close();
}

function finalFunction() {
    console.log("Graceful shutdown successfully!");
}

gracefulShutdown(server, {
    signals: "SIGINT SIGTERM",
    timeout: 30000,                   // timeout: 30 secs
    development: false,               // not in dev mode
    forceExit: true,                  // triggers process.exit() at the end of shutdown process
    onShutdown: shutdownFunction,     // shutdown function (async) - e.g. for cleanup DB, ...
    finally: finalFunction,            // finally function (sync) - e.g. for logging
});

// Catch unexpected errors here
process.addListener("unhandledRejection", (error, promise) => {
    console.trace(error);
    console.error("If you keep encountering errors, please report to https://github.com/louislam/uptime-kuma/issues");
});
