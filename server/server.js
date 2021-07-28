console.log("Welcome to Uptime Kuma ")
console.log("Importing libraries")
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dayjs = require("dayjs");
const { R } = require("redbean-node");
const jwt = require("jsonwebtoken");
const Monitor = require("./model/monitor");
const fs = require("fs");
const { getSettings } = require("./util-server");
const { Notification } = require("./notification")
const gracefulShutdown = require("http-graceful-shutdown");
const Database = require("./database");
const { sleep } = require("./util");
const args = require("args-parser")(process.argv);
const prometheusAPIMetrics = require("prometheus-api-metrics");
const { basicAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");
const version = require("../package.json").version;
const hostname = args.host || "0.0.0.0"
const port = args.port || 3001

console.info("Version: " + version)

console.log("Creating express and socket.io instance")
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json())

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

(async () => {
    await initDatabase();

    console.log("Adding route")

    // Normal Router here

    app.use("/", express.static("dist"));

    // Basic Auth Router here

    // Prometheus API metrics  /metrics
    // With Basic Auth using the first user's username/password
    app.get("/metrics", basicAuth, prometheusAPIMetrics())

    // Universal Route Handler, must be at the end
    app.get("*", function(request, response, next) {
        response.end(indexHTML)
    });

    console.log("Adding socket handler")
    io.on("connection", async (socket) => {

        socket.emit("info", {
            version,
        })

        totalClient++;

        if (needSetup) {
            console.log("Redirect to setup page")
            socket.emit("setup")
        }

        socket.on("disconnect", () => {
            totalClient--;
        });

        // Public API

        socket.on("loginByToken", async (token, callback) => {

            try {
                let decoded = jwt.verify(token, jwtSecret);

                console.log("Username from JWT: " + decoded.username)

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ])

                if (user) {
                    await afterLogin(socket, user)

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
                await afterLogin(socket, user)

                callback({
                    ok: true,
                    token: jwt.sign({
                        username: data.username,
                    }, jwtSecret),
                })
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

        // Auth Only API

        socket.on("add", async (monitor, callback) => {
            try {
                checkLogin(socket)
                let bean = R.dispense("monitor")

                let notificationIDList = monitor.notificationIDList;
                delete monitor.notificationIDList;

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
                bean.hostname = monitor.hostname;
                bean.maxretries = monitor.maxretries;
                bean.port = monitor.port;
                bean.keyword = monitor.keyword;

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

                    await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
                        passwordHash.generate(password.newPassword),
                        socket.userID,
                    ]);

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

        socket.on("getSettings", async (type, callback) => {
            try {
                checkLogin(socket)

                callback({
                    ok: true,
                    data: await getSettings(type),
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

                await Notification.save(notification, notificationID, socket.userID)
                await sendNotificationList(socket)

                callback({
                    ok: true,
                    msg: "Saved",
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
    });

    console.log("Init")
    server.listen(port, hostname, () => {
        console.log(`Listening on ${hostname}:${port}`);
        startMonitors();
    });

})();

async function updateMonitorNotification(monitorID, notificationIDList) {
    R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [
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

async function sendNotificationList(socket) {
    let result = [];
    let list = await R.find("notification", " user_id = ? ", [
        socket.userID,
    ]);

    for (let bean of list) {
        result.push(bean.export())
    }

    io.to(socket.userID).emit("notificationList", result)
    return list;
}

async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id)

    let monitorList = await sendMonitorList(socket)

    for (let monitorID in monitorList) {
        sendHeartbeatList(socket, monitorID);
        sendImportantHeartbeatList(socket, monitorID);
        Monitor.sendStats(io, monitorID, user.id)
    }

    sendNotificationList(socket)
}

async function getMonitorJSONList(userID) {
    let result = {};

    let monitorList = await R.find("monitor", " user_id = ? ", [
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
    R.setup("sqlite", {
        filename: Database.path,
    });
    console.log("Connected")

    // Patch the database
    await Database.patch()

    // Auto map the model to a bean object
    R.freeze(true)
    await R.autoloadModels("./server/model");

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (! jwtSecretBean) {
        console.log("JWT secret is not found, generate one.")
        jwtSecretBean = R.dispense("setting")
        jwtSecretBean.key = "jwtSecret"

        jwtSecretBean.value = passwordHash.generate(dayjs() + "")
        await R.store(jwtSecretBean)
        console.log("Stored JWT secret into database")
    } else {
        console.log("Load JWT secret from database.")
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
        monitor.start(io)
        monitorList[monitor.id] = monitor;
    }
}

/**
 * Send Heartbeat History list to socket
 */
async function sendHeartbeatList(socket, monitorID) {
    let list = await R.find("heartbeat", `
        monitor_id = ?
        ORDER BY time DESC
        LIMIT 100
    `, [
        monitorID,
    ])

    let result = [];

    for (let bean of list) {
        result.unshift(bean.toJSON())
    }

    socket.emit("heartbeatList", monitorID, result)
}

async function sendImportantHeartbeatList(socket, monitorID) {
    let list = await R.find("heartbeat", `
        monitor_id = ?
        AND important = 1
        ORDER BY time DESC
        LIMIT 500
    `, [
        monitorID,
    ])

    socket.emit("importantHeartbeatList", monitorID, list)
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
    console.log("Stopped DB")
}

function finalFunction() {
    console.log("Graceful Shutdown Done")
}

gracefulShutdown(server, {
    signals: "SIGINT SIGTERM",
    timeout: 30000,                   // timeout: 30 secs
    development: false,               // not in dev mode
    forceExit: true,                  // triggers process.exit() at the end of shutdown process
    onShutdown: shutdownFunction,     // shutdown function (async) - e.g. for cleanup DB, ...
    finally: finalFunction,            // finally function (sync) - e.g. for logging
});
