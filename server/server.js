const args = require("args-parser")(process.argv);
const { sleep, log, getRandomInt, genSecret } = require("../src/util");
const config = require("./config");

log("server", "Welcome to Uptime Kuma");
log("server", "Arguments", "debug");
log("server", args, "debug");

if (! process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

log("server", "Node Env: " + process.env.NODE_ENV);

log("server", "Importing Node libraries");
const fs = require("fs");
const http = require("http");
const https = require("https");

log("server", "Importing 3rd-party libraries");
log("server", "Importing express", "debug");
const express = require("express");
log("server", "Importing socket.io", "debug");
const { Server } = require("socket.io");
log("server", "Importing redbean-node", "debug");
const { R } = require("redbean-node");
log("server", "Importing jsonwebtoken", "debug");
const jwt = require("jsonwebtoken");
log("server", "Importing http-graceful-shutdown", "debug");
const gracefulShutdown = require("http-graceful-shutdown");
log("server", "Importing prometheus-api-metrics", "debug");
const prometheusAPIMetrics = require("prometheus-api-metrics");
log("server", "Importing compare-versions", "debug");
const compareVersions = require("compare-versions");
const { passwordStrength } = require("check-password-strength");

log("server", "Importing 2FA Modules", "debug");
const notp = require("notp");
const base32 = require("thirty-two");

log("server", "Importing this project modules");
log("server", "Importing Monitor", "debug");
const Monitor = require("./model/monitor");
log("server", "Importing Settings", "debug");
const { getSettings, setSettings, setting, initJWTSecret, checkLogin, startUnitTest, FBSD, errorLog } = require("./util-server");

log("server", "Importing Notification", "debug");
const { Notification } = require("./notification");
Notification.init();

log("server", "Importing Database", "debug");
const Database = require("./database");

log("server", "Importing Background Jobs", "debug");
const { initBackgroundJobs } = require("./jobs");
const { loginRateLimiter } = require("./rate-limiter");

const { basicAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const checkVersion = require("./check-version");
log("server", "Version: " + checkVersion.version);

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
let hostname = process.env.UPTIME_KUMA_HOST || args.host;

// Also read HOST if not FreeBSD, as HOST is a system environment variable in FreeBSD
if (!hostname && !FBSD) {
    hostname = process.env.HOST;
}

if (hostname) {
    log("server", "Custom hostname: " + hostname);
}

const port = parseInt(process.env.UPTIME_KUMA_PORT || process.env.PORT || args.port || 3001);

// SSL
const sslKey = process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || args["ssl-key"] || undefined;
const sslCert = process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || args["ssl-cert"] || undefined;
const disableFrameSameOrigin = !!process.env.UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN || args["disable-frame-sameorigin"] || false;

// 2FA / notp verification defaults
const twofa_verification_opts = {
    "window": 1,
    "time": 30
};

/**
 * Run unit test after the server is ready
 * @type {boolean}
 */
const testMode = !!args["test"] || false;

if (config.demoMode) {
    log("server", "==== Demo Mode ====");
}

log("server", "Creating express and socket.io instance");
const app = express();

let server;

if (sslKey && sslCert) {
    log("server", "Server Type: HTTPS");
    server = https.createServer({
        key: fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert)
    }, app);
} else {
    log("server", "Server Type: HTTP");
    server = http.createServer(app);
}

const io = new Server(server);
module.exports.io = io;

// Must be after io instantiation
const { sendNotificationList, sendHeartbeatList, sendImportantHeartbeatList, sendInfo } = require("./client");
const { statusPageSocketHandler } = require("./socket-handlers/status-page-socket-handler");
const databaseSocketHandler = require("./socket-handlers/database-socket-handler");

app.use(express.json());

// Global Middleware
app.use(function (req, res, next) {
    if (!disableFrameSameOrigin) {
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    res.removeHeader("X-Powered-By");
    next();
});

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
let indexHTML = "";

try {
    indexHTML = fs.readFileSync("./dist/index.html").toString();
} catch (e) {
    // "dist/index.html" is not necessary for development
    if (process.env.NODE_ENV !== "development") {
        log("server", "Error: Cannot find 'dist/index.html', did you install correctly?", "error");
        process.exit(1);
    }
}

exports.entryPage = "dashboard";

(async () => {
    Database.init(args);
    await initDatabase();

    exports.entryPage = await setting("entryPage");

    log("server", "Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Entry Page
    app.get("/", async (_request, response) => {
        if (exports.entryPage === "statusPage") {
            response.redirect("/status");
        } else {
            response.redirect("/dashboard");
        }
    });

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

    // ./data/upload
    app.use("/upload", express.static(Database.uploadDir));

    app.get("/.well-known/change-password", async (_, response) => {
        response.redirect("https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI");
    });

    // API Router
    const apiRouter = require("./routers/api-router");
    app.use(apiRouter);

    // Universal Route Handler, must be at the end of all express routes.
    app.get("*", async (_request, response) => {
        if (_request.originalUrl.startsWith("/upload/")) {
            response.status(404).send("File not found.");
        } else {
            response.send(indexHTML);
        }
    });

    log("server", "Adding socket handler");
    io.on("connection", async (socket) => {

        sendInfo(socket);

        totalClient++;

        if (needSetup) {
            log("server", "Redirect to setup page");
            socket.emit("setup");
        }

        socket.on("disconnect", () => {
            totalClient--;
        });

        // ***************************
        // Public Socket API
        // ***************************

        socket.on("loginByToken", async (token, callback) => {
            log("auth", `Login by token. IP=${getClientIp(socket)}`);

            try {
                let decoded = jwt.verify(token, jwtSecret);

                log("auth", "Username from JWT: " + decoded.username);

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ]);

                if (user) {
                    log("auth", "afterLogin", "debug");
                    afterLogin(socket, user);
                    log("auth", "afterLogin ok", "debug");

                    log("auth", `Successfully logged in user ${decoded.username}. IP=${getClientIp(socket)}`);

                    callback({
                        ok: true,
                    });
                } else {

                    log("auth", `Inactive or deleted user ${decoded.username}. IP=${getClientIp(socket)}`);

                    callback({
                        ok: false,
                        msg: "The user is inactive or deleted.",
                    });
                }
            } catch (error) {

                log("auth", `Invalid token for user ${decoded.username}. IP=${getClientIp(socket)}`, "error");

                callback({
                    ok: false,
                    msg: "Invalid token.",
                });
            }

        });

        socket.on("login", async (data, callback) => {
            log("auth", `Login by username + password. IP=${getClientIp(socket)}`);

            // Login Rate Limit
            if (! await loginRateLimiter.pass(callback)) {
                log("auth", `Too many failed requests for user ${data.username}. IP=${getClientIp(socket)}`);
                return;
            }

            let user = await login(data.username, data.password);

            if (user) {
                if (user.twofa_status == 0) {
                    afterLogin(socket, user);

                    log("auth", `Successfully logged in user ${data.username}. IP=${getClientIp(socket)}`);

                    callback({
                        ok: true,
                        token: jwt.sign({
                            username: data.username,
                        }, jwtSecret),
                    });
                }

                if (user.twofa_status == 1 && !data.token) {

                    log("auth", `2FA token required for user ${data.username}. IP=${getClientIp(socket)}`);

                    callback({
                        tokenRequired: true,
                    });
                }

                if (data.token) {
                    let verify = notp.totp.verify(data.token, user.twofa_secret, twofa_verification_opts);

                    if (user.twofa_last_token !== data.token && verify) {
                        afterLogin(socket, user);

                        await R.exec("UPDATE `user` SET twofa_last_token = ? WHERE id = ? ", [
                            data.token,
                            socket.userID,
                        ]);

                        log("auth", `Successfully logged in user ${data.username}. IP=${getClientIp(socket)}`);

                        callback({
                            ok: true,
                            token: jwt.sign({
                                username: data.username,
                            }, jwtSecret),
                        });
                    } else {

                        log("auth", `Invalid token provided for user ${data.username}. IP=${getClientIp(socket)}`, "warn");

                        callback({
                            ok: false,
                            msg: "Invalid Token!",
                        });
                    }
                }
            } else {

                log("auth", `Incorrect username or password for user ${data.username}. IP=${getClientIp(socket)}`, "warn");

                callback({
                    ok: false,
                    msg: "Incorrect username or password.",
                });
            }

        });

        socket.on("logout", async (callback) => {
            socket.leave(socket.userID);
            socket.userID = null;
            callback();
        });

        socket.on("prepare2FA", async (callback) => {
            try {
                checkLogin(socket);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);

                if (user.twofa_status == 0) {
                    let newSecret = genSecret();
                    let encodedSecret = base32.encode(newSecret);

                    // Google authenticator doesn't like equal signs
                    // The fix is found at https://github.com/guyht/notp
                    // Related issue: https://github.com/louislam/uptime-kuma/issues/486
                    encodedSecret = encodedSecret.toString().replace(/=/g, "");

                    let uri = `otpauth://totp/Uptime%20Kuma:${user.username}?secret=${encodedSecret}`;

                    await R.exec("UPDATE `user` SET twofa_secret = ? WHERE id = ? ", [
                        newSecret,
                        socket.userID,
                    ]);

                    callback({
                        ok: true,
                        uri: uri,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "2FA is already enabled.",
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to prepare 2FA.",
                });
            }
        });

        socket.on("save2FA", async (callback) => {
            try {
                checkLogin(socket);

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [
                    socket.userID,
                ]);

                log("auth", `Saved 2FA token for user ${data.username}. IP=${getClientIp(socket)}`);

                callback({
                    ok: true,
                    msg: "2FA Enabled.",
                });
            } catch (error) {

                log("auth", `Error changing 2FA token for user ${data.username}. IP=${getClientIp(socket)}`, "error");

                callback({
                    ok: false,
                    msg: "Error while trying to change 2FA.",
                });
            }
        });

        socket.on("disable2FA", async (callback) => {
            try {
                checkLogin(socket);

                await R.exec("UPDATE `user` SET twofa_status = 0 WHERE id = ? ", [
                    socket.userID,
                ]);

                log("auth", `Disabled 2FA token for user ${data.username}. IP=${getClientIp(socket)}`);

                callback({
                    ok: true,
                    msg: "2FA Disabled.",
                });
            } catch (error) {

                log("auth", `Error disabling 2FA token for user ${data.username}. IP=${getClientIp(socket)}`, "error");

                callback({
                    ok: false,
                    msg: "Error while trying to disable 2FA.",
                });
            }
        });

        socket.on("verifyToken", async (token, callback) => {
            let user = await R.findOne("user", " id = ? AND active = 1 ", [
                socket.userID,
            ]);

            let verify = notp.totp.verify(token, user.twofa_secret, twofa_verification_opts);

            if (user.twofa_last_token !== token && verify) {
                callback({
                    ok: true,
                    valid: true,
                });
            } else {
                callback({
                    ok: false,
                    msg: "Invalid Token.",
                    valid: false,
                });
            }
        });

        socket.on("twoFAStatus", async (callback) => {
            checkLogin(socket);

            try {
                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);

                if (user.twofa_status == 1) {
                    callback({
                        ok: true,
                        status: true,
                    });
                } else {
                    callback({
                        ok: true,
                        status: false,
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Error while trying to get 2FA status.",
                });
            }
        });

        socket.on("needSetup", async (callback) => {
            callback(needSetup);
        });

        socket.on("setup", async (username, password, callback) => {
            try {
                if (passwordStrength(password).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                if ((await R.count("user")) !== 0) {
                    throw new Error("Uptime Kuma has been initialized. If you want to run setup again, please delete the database.");
                }

                let user = R.dispense("user");
                user.username = username;
                user.password = passwordHash.generate(password);
                await R.store(user);

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
                checkLogin(socket);
                let bean = R.dispense("monitor");

                let notificationIDList = monitor.notificationIDList;
                delete monitor.notificationIDList;

                monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                delete monitor.accepted_statuscodes;

                bean.import(monitor);
                bean.user_id = socket.userID;
                await R.store(bean);

                await updateMonitorNotification(bean.id, notificationIDList);

                await startMonitor(socket.userID, bean.id);
                await sendMonitorList(socket);

                log("monitor", `Added Monitor: ${monitorID} User ID: ${socket.userID}`);

                callback({
                    ok: true,
                    msg: "Added Successfully.",
                    monitorID: bean.id,
                });

            } catch (e) {

                log("monitor", `Error adding Monitor: ${monitorID} User ID: ${socket.userID}`, "error");

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Edit a monitor
        socket.on("editMonitor", async (monitor, callback) => {
            try {
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [ monitor.id ]);

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.");
                }

                bean.name = monitor.name;
                bean.type = monitor.type;
                bean.url = monitor.url;
                bean.method = monitor.method;
                bean.body = monitor.body;
                bean.headers = monitor.headers;
                bean.interval = monitor.interval;
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
                bean.pushToken = monitor.pushToken;

                await R.store(bean);

                await updateMonitorNotification(bean.id, monitor.notificationIDList);

                if (bean.active) {
                    await restartMonitor(socket.userID, bean.id);
                }

                await sendMonitorList(socket);

                callback({
                    ok: true,
                    msg: "Saved.",
                    monitorID: bean.id,
                });

            } catch (e) {
                console.error(e);
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitorList", async (callback) => {
            try {
                checkLogin(socket);
                await sendMonitorList(socket);
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

        socket.on("getMonitor", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                log("monitor", `Get Monitor: ${monitorID} User ID: ${socket.userID}`);

                let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);

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

        socket.on("getMonitorBeats", async (monitorID, period, callback) => {
            try {
                checkLogin(socket);

                log("monitor", `Get Monitor Beats: ${monitorID} User ID: ${socket.userID}`);

                if (period == null) {
                    throw new Error("Invalid period.");
                }

                let list = await R.getAll(`
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ? AND
                    time > DATETIME('now', '-' || ? || ' hours')
                    ORDER BY time ASC
                `, [
                    monitorID,
                    period,
                ]);

                callback({
                    ok: true,
                    data: list,
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
                checkLogin(socket);
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
                checkLogin(socket);
                await pauseMonitor(socket.userID, monitorID);
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
                checkLogin(socket);

                log("manage", `Delete Monitor: ${monitorID} User ID: ${socket.userID}`);

                if (monitorID in monitorList) {
                    monitorList[monitorID].stop();
                    delete monitorList[monitorID];
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
                // Clear heartbeat list on client
                await sendImportantHeartbeatList(socket, monitorID, true, true);

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getTags", async (callback) => {
            try {
                checkLogin(socket);

                const list = await R.findAll("tag");

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
                checkLogin(socket);

                let bean = R.dispense("tag");
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);

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
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [ tag.id ]);
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);

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
                checkLogin(socket);

                await R.exec("DELETE FROM tag WHERE id = ? ", [ tagID ]);

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
                checkLogin(socket);

                await R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)", [
                    tagID,
                    monitorID,
                    value,
                ]);

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
                checkLogin(socket);

                await R.exec("UPDATE monitor_tag SET value = ? WHERE tag_id = ? AND monitor_id = ?", [
                    value,
                    tagID,
                    monitorID,
                ]);

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
                checkLogin(socket);

                await R.exec("DELETE FROM monitor_tag WHERE tag_id = ? AND monitor_id = ? AND value = ?", [
                    tagID,
                    monitorID,
                    value,
                ]);

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
                checkLogin(socket);

                if (! password.newPassword) {
                    throw new Error("Invalid new password");
                }

                if (passwordStrength(password.newPassword).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);

                if (user && passwordHash.verify(password.currentPassword, user.password)) {

                    user.resetPassword(password.newPassword);

                    callback({
                        ok: true,
                        msg: "Password has been updated successfully.",
                    });
                } else {
                    throw new Error("Incorrect current password");
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
                checkLogin(socket);

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
                checkLogin(socket);

                await setSettings("general", data);
                exports.entryPage = data.entryPage;

                callback({
                    ok: true,
                    msg: "Saved"
                });

                sendInfo(socket);

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
                checkLogin(socket);

                let notificationBean = await Notification.save(notification, notificationID, socket.userID);
                await sendNotificationList(socket);

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
                checkLogin(socket);

                await Notification.delete(notificationID, socket.userID);
                await sendNotificationList(socket);

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
                checkLogin(socket);

                let msg = await Notification.send(notification, notification.name + " Testing");

                callback({
                    ok: true,
                    msg,
                });

            } catch (e) {
                console.error(e);

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("checkApprise", async (callback) => {
            try {
                checkLogin(socket);
                callback(Notification.checkApprise());
            } catch (e) {
                callback(false);
            }
        });

        socket.on("uploadBackup", async (uploadedJSON, importHandle, callback) => {
            try {
                checkLogin(socket);

                let backupData = JSON.parse(uploadedJSON);

                log("manage", `Importing Backup, User ID: ${socket.userID}, Version: ${backupData.version}`);

                let notificationListData = backupData.notificationList;
                let monitorListData = backupData.monitorList;

                let version17x = compareVersions.compare(backupData.version, "1.7.0", ">=");

                // If the import option is "overwrite" it'll clear most of the tables, except "settings" and "user"
                if (importHandle == "overwrite") {
                    // Stops every monitor first, so it doesn't execute any heartbeat while importing
                    for (let id in monitorList) {
                        let monitor = monitorList[id];
                        await monitor.stop();
                    }
                    await R.exec("DELETE FROM heartbeat");
                    await R.exec("DELETE FROM monitor_notification");
                    await R.exec("DELETE FROM monitor_tls_info");
                    await R.exec("DELETE FROM notification");
                    await R.exec("DELETE FROM monitor_tag");
                    await R.exec("DELETE FROM tag");
                    await R.exec("DELETE FROM monitor");
                }

                // Only starts importing if the backup file contains at least one notification
                if (notificationListData.length >= 1) {
                    // Get every existing notification name and puts them in one simple string
                    let notificationNameList = await R.getAll("SELECT name FROM notification");
                    let notificationNameListString = JSON.stringify(notificationNameList);

                    for (let i = 0; i < notificationListData.length; i++) {
                        // Only starts importing the notification if the import option is "overwrite", "keep" or "skip" but the notification doesn't exists
                        if ((importHandle == "skip" && notificationNameListString.includes(notificationListData[i].name) == false) || importHandle == "keep" || importHandle == "overwrite") {

                            let notification = JSON.parse(notificationListData[i].config);
                            await Notification.save(notification, null, socket.userID);

                        }
                    }
                }

                // Only starts importing if the backup file contains at least one monitor
                if (monitorListData.length >= 1) {
                    // Get every existing monitor name and puts them in one simple string
                    let monitorNameList = await R.getAll("SELECT name FROM monitor");
                    let monitorNameListString = JSON.stringify(monitorNameList);

                    for (let i = 0; i < monitorListData.length; i++) {
                        // Only starts importing the monitor if the import option is "overwrite", "keep" or "skip" but the notification doesn't exists
                        if ((importHandle == "skip" && monitorNameListString.includes(monitorListData[i].name) == false) || importHandle == "keep" || importHandle == "overwrite") {

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
                                interval: monitorListData[i].interval,
                                retryInterval: retryInterval,
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

                            await updateMonitorNotification(bean.id, notificationIDList);

                            // If monitor was active start it immediately, otherwise pause it
                            if (monitorListData[i].active == 1) {
                                await startMonitor(socket.userID, bean.id);
                            } else {
                                await pauseMonitor(socket.userID, bean.id);
                            }

                        }
                    }

                    await sendNotificationList(socket);
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
                checkLogin(socket);

                log("manage", `Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`);

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
                checkLogin(socket);

                log("manage", `Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`);

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
                checkLogin(socket);

                log("manage", `Clear Statistics User ID: ${socket.userID}`);

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

        // Status Page Socket Handler for admin only
        statusPageSocketHandler(socket);
        databaseSocketHandler(socket);

        log("server", "added all socket handlers", "debug");

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        log("auth", "check auto login", "debug");
        if (await setting("disableAuth")) {
            log("auth", "Disabled Auth: auto login to admin");
            afterLogin(socket, await R.findOne("user"));
            socket.emit("autoLogin");
        } else {
            log("auth", "need auth", "debug");
        }

    });

    log("server", "Init the server");

    server.once("error", async (err) => {
        console.error("Cannot listen: " + err.message);
        await Database.close();
    });

    server.listen(port, hostname, () => {
        if (hostname) {
            log("server", `Listening on ${hostname}:${port}`);
        } else {
            log("server", `Listening on ${port}`);
        }
        startMonitors();
        checkVersion.startInterval();

        if (testMode) {
            startUnitTest();
        }
    });

    initBackgroundJobs(args);

})();

async function updateMonitorNotification(monitorID, notificationIDList) {
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [
        monitorID,
    ]);

    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

async function checkOwner(userID, monitorID) {
    let row = await R.getRow("SELECT id FROM monitor WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    if (! row) {
        throw new Error("You do not own this monitor.");
    }
}

async function sendMonitorList(socket) {
    let list = await getMonitorJSONList(socket.userID);
    io.to(socket.userID).emit("monitorList", list);
    return list;
}

async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id);

    let monitorList = await sendMonitorList(socket);
    sendNotificationList(socket);

    await sleep(500);

    for (let monitorID in monitorList) {
        await sendHeartbeatList(socket, monitorID);
    }

    for (let monitorID in monitorList) {
        await sendImportantHeartbeatList(socket, monitorID);
    }

    for (let monitorID in monitorList) {
        await Monitor.sendStats(io, monitorID, user.id);
    }
}

async function getMonitorJSONList(userID) {
    let result = {};

    let monitorList = await R.find("monitor", " user_id = ? ORDER BY weight DESC, name", [
        userID,
    ]);

    for (let monitor of monitorList) {
        result[monitor.id] = await monitor.toJSON();
    }

    return result;
}

async function initDatabase() {
    if (! fs.existsSync(Database.path)) {
        log("server", "Copying Database");
        fs.copyFileSync(Database.templatePath, Database.path);
    }

    log("server", "Connecting to the Database");
    await Database.connect();
    log("server", "Connected");

    // Patch the database
    await Database.patch();

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (! jwtSecretBean) {
        log("server", "JWT secret is not found, generate one.");
        jwtSecretBean = await initJWTSecret();
        log("server", "Stored JWT secret into database");
    } else {
        log("server", "Load JWT secret from database.");
    }

    // If there is no record in user table, it is a new Uptime Kuma instance, need to setup
    if ((await R.count("user")) === 0) {
        log("server", "No user, need setup");
        needSetup = true;
    }

    jwtSecret = jwtSecretBean.value;
}

async function startMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log("manage", `Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    let monitor = await R.findOne("monitor", " id = ? ", [
        monitorID,
    ]);

    if (monitor.id in monitorList) {
        monitorList[monitor.id].stop();
    }

    monitorList[monitor.id] = monitor;
    monitor.start(io);
}

async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID);
}

async function pauseMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log("manage", `Pause Monitor: ${monitorID} User ID: ${userID}`);

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
    let list = await R.find("monitor", " active = 1 ");

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
    log("server", "Shutdown requested");
    log("server", "Called signal: " + signal);

    log("server", "Stopping all monitors");
    for (let id in monitorList) {
        let monitor = monitorList[id];
        monitor.stop();
    }
    await sleep(2000);
    await Database.close();
}

function getClientIp(socket) {
    return socket.client.conn.remoteAddress.replace(/^.*:/, "")
}

function finalFunction() {
    log("server", "Graceful shutdown successful!");
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
    errorLog(error, false);
    console.error("If you keep encountering errors, please report to https://github.com/louislam/uptime-kuma/issues");
});
