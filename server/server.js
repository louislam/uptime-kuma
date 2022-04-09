console.log("Welcome to Uptime Kuma");

// Check Node.js Version
const nodeVersion = parseInt(process.versions.node.split(".")[0]);
const requiredVersion = 14;
console.log(`Your Node.js version: ${nodeVersion}`);

if (nodeVersion < requiredVersion) {
    console.error(`Error: Your Node.js version is not supported, please upgrade to Node.js >= ${requiredVersion}.`);
    process.exit(-1);
}

const args = require("args-parser")(process.argv);
const { sleep, debug, getRandomInt, genSecret } = require("../src/util");
const config = require("./config");

debug(args);

if (! process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

console.log("Node Env: " + process.env.NODE_ENV);

console.log("Importing Node libraries");
const fs = require("fs");
const http = require("http");
const https = require("https");

console.log("Importing 3rd-party libraries");
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
debug("Importing compare-versions");
const compareVersions = require("compare-versions");
const { passwordStrength } = require("check-password-strength");

debug("Importing 2FA Modules");
const notp = require("notp");
const base32 = require("thirty-two");

/**
 * `module.exports` (alias: `server`) should be inside this class, in order to avoid circular dependency issue.
 * @type {UptimeKumaServer}
 */
class UptimeKumaServer {
    /**
     * Main monitor list
     * @type {{}}
     */
    monitorList = {};
    entryPage = "dashboard";

    async sendMonitorList(socket) {
        let list = await getMonitorJSONList(socket.userID);
        io.to(socket.userID).emit("monitorList", list);
        return list;
    }
}

const server = module.exports = new UptimeKumaServer();

console.log("Importing this project modules");
debug("Importing Monitor");
const Monitor = require("./model/monitor");
debug("Importing Settings");
const { getSettings, setSettings, setting, initJWTSecret, checkLogin, startUnitTest, FBSD, errorLog, doubleCheckPassword } = require("./util-server");

debug("Importing Notification");
const { Notification } = require("./notification");
Notification.init();

debug("Importing Proxy");
const { Proxy } = require("./proxy");

debug("Importing Database");
const Database = require("./database");

debug("Importing Background Jobs");
const { initBackgroundJobs, stopBackgroundJobs } = require("./jobs");
const { loginRateLimiter, twoFaRateLimiter } = require("./rate-limiter");

const { basicAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const checkVersion = require("./check-version");
console.info("Version: " + checkVersion.version);

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
let hostname = process.env.UPTIME_KUMA_HOST || args.host;

// Also read HOST if not FreeBSD, as HOST is a system environment variable in FreeBSD
if (!hostname && !FBSD) {
    hostname = process.env.HOST;
}

if (hostname) {
    console.log("Custom hostname: " + hostname);
}

const port = parseInt(process.env.UPTIME_KUMA_PORT || process.env.PORT || args.port || 3001);

// SSL
const sslKey = process.env.UPTIME_KUMA_SSL_KEY || process.env.SSL_KEY || args["ssl-key"] || undefined;
const sslCert = process.env.UPTIME_KUMA_SSL_CERT || process.env.SSL_CERT || args["ssl-cert"] || undefined;
const disableFrameSameOrigin = !!process.env.UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN || args["disable-frame-sameorigin"] || false;
const cloudflaredToken = args["cloudflared-token"] || process.env.UPTIME_KUMA_CLOUDFLARED_TOKEN || undefined;

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
    console.log("==== Demo Mode ====");
}

console.log("Creating express and socket.io instance");
const app = express();

let httpServer;

if (sslKey && sslCert) {
    console.log("Server Type: HTTPS");
    httpServer = https.createServer({
        key: fs.readFileSync(sslKey),
        cert: fs.readFileSync(sslCert)
    }, app);
} else {
    console.log("Server Type: HTTP");
    httpServer = http.createServer(app);
}

const io = new Server(httpServer);
module.exports.io = io;

// Must be after io instantiation
const { sendNotificationList, sendHeartbeatList, sendImportantHeartbeatList, sendInfo, sendProxyList } = require("./client");
const { statusPageSocketHandler } = require("./socket-handlers/status-page-socket-handler");
const databaseSocketHandler = require("./socket-handlers/database-socket-handler");
const TwoFA = require("./2fa");
const StatusPage = require("./model/status_page");
const { cloudflaredSocketHandler, autoStart: cloudflaredAutoStart, stop: cloudflaredStop } = require("./socket-handlers/cloudflared-socket-handler");
const { proxySocketHandler } = require("./socket-handlers/proxy-socket-handler");

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
        console.error("Error: Cannot find 'dist/index.html', did you install correctly?");
        process.exit(1);
    }
}

(async () => {
    Database.init(args);
    await initDatabase(testMode);

    exports.entryPage = await setting("entryPage");
    await StatusPage.loadDomainMappingList();

    console.log("Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Entry Page
    app.get("/", async (request, response) => {
        debug(`Request Domain: ${request.hostname}`);

        if (request.hostname in StatusPage.domainMappingList) {
            debug("This is a status page domain");
            response.send(indexHTML);
        } else if (exports.entryPage && exports.entryPage.startsWith("statusPage-")) {
            response.redirect("/status/" + exports.entryPage.replace("statusPage-", ""));
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

    console.log("Adding socket handler");
    io.on("connection", async (socket) => {

        sendInfo(socket);

        totalClient++;

        if (needSetup) {
            console.log("Redirect to setup page");
            socket.emit("setup");
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

                console.log("Username from JWT: " + decoded.username);

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ]);

                if (user) {
                    debug("afterLogin");

                    afterLogin(socket, user);

                    debug("afterLogin ok");

                    callback({
                        ok: true,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "The user is inactive or deleted.",
                    });
                }
            } catch (error) {
                callback({
                    ok: false,
                    msg: "Invalid token.",
                });
            }

        });

        socket.on("login", async (data, callback) => {
            console.log("Login");

            // Checking
            if (typeof callback !== "function") {
                return;
            }

            if (!data) {
                return;
            }

            // Login Rate Limit
            if (! await loginRateLimiter.pass(callback)) {
                return;
            }

            let user = await login(data.username, data.password);

            if (user) {
                if (user.twofa_status == 0) {
                    afterLogin(socket, user);
                    callback({
                        ok: true,
                        token: jwt.sign({
                            username: data.username,
                        }, jwtSecret),
                    });
                }

                if (user.twofa_status == 1 && !data.token) {
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

                        callback({
                            ok: true,
                            token: jwt.sign({
                                username: data.username,
                            }, jwtSecret),
                        });
                    } else {
                        callback({
                            ok: false,
                            msg: "Invalid Token!",
                        });
                    }
                }
            } else {
                callback({
                    ok: false,
                    msg: "Incorrect username or password.",
                });
            }

        });

        socket.on("logout", async (callback) => {
            // Rate Limit
            if (! await loginRateLimiter.pass(callback)) {
                return;
            }

            socket.leave(socket.userID);
            socket.userID = null;

            if (typeof callback === "function") {
                callback();
            }
        });

        socket.on("prepare2FA", async (currentPassword, callback) => {
            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

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
                    msg: error.message,
                });
            }
        });

        socket.on("save2FA", async (currentPassword, callback) => {
            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [
                    socket.userID,
                ]);

                callback({
                    ok: true,
                    msg: "2FA Enabled.",
                });
            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("disable2FA", async (currentPassword, callback) => {
            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);
                await TwoFA.disable2FA(socket.userID);

                callback({
                    ok: true,
                    msg: "2FA Disabled.",
                });
            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("verifyToken", async (token, currentPassword, callback) => {
            try {
                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

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

            } catch (error) {
                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("twoFAStatus", async (callback) => {
            try {
                checkLogin(socket);

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
                console.log(error);
                callback({
                    ok: false,
                    msg: error.message,
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

                await server.sendMonitorList(socket);
                await startMonitor(socket.userID, bean.id);

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
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [ monitor.id ]);

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.");
                }

                // Reset Prometheus labels
                server.monitorList[monitor.id]?.prometheus()?.remove();

                bean.name = monitor.name;
                bean.type = monitor.type;
                bean.url = monitor.url;
                bean.method = monitor.method;
                bean.body = monitor.body;
                bean.headers = monitor.headers;
                bean.basic_auth_user = monitor.basic_auth_user;
                bean.basic_auth_pass = monitor.basic_auth_pass;
                bean.interval = monitor.interval;
                bean.retryInterval = monitor.retryInterval;
                bean.hostname = monitor.hostname;
                bean.maxretries = monitor.maxretries;
                bean.port = monitor.port;
                bean.keyword = monitor.keyword;
                bean.ignoreTls = monitor.ignoreTls;
                bean.expiryNotification = monitor.expiryNotification;
                bean.upsideDown = monitor.upsideDown;
                bean.maxredirects = monitor.maxredirects;
                bean.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                bean.dns_resolve_type = monitor.dns_resolve_type;
                bean.dns_resolve_server = monitor.dns_resolve_server;
                bean.pushToken = monitor.pushToken;
                bean.proxyId = Number.isInteger(monitor.proxyId) ? monitor.proxyId : null;

                await R.store(bean);

                await updateMonitorNotification(bean.id, monitor.notificationIDList);

                if (bean.active) {
                    await restartMonitor(socket.userID, bean.id);
                }

                await server.sendMonitorList(socket);

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
                await server.sendMonitorList(socket);
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

                console.log(`Get Monitor: ${monitorID} User ID: ${socket.userID}`);

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

                console.log(`Get Monitor Beats: ${monitorID} User ID: ${socket.userID}`);

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
                await server.sendMonitorList(socket);

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
                await server.sendMonitorList(socket);

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

                console.log(`Delete Monitor: ${monitorID} User ID: ${socket.userID}`);

                if (monitorID in server.monitorList) {
                    server.monitorList[monitorID].stop();
                    delete server.monitorList[monitorID];
                }

                await R.exec("DELETE FROM monitor WHERE id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);

                callback({
                    ok: true,
                    msg: "Deleted Successfully.",
                });

                await server.sendMonitorList(socket);
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

                let user = await doubleCheckPassword(socket, password.currentPassword);
                await user.resetPassword(password.newPassword);

                callback({
                    ok: true,
                    msg: "Password has been updated successfully.",
                });

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

        socket.on("setSettings", async (data, currentPassword, callback) => {
            try {
                checkLogin(socket);

                if (data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
                }

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

                console.log(`Importing Backup, User ID: ${socket.userID}, Version: ${backupData.version}`);

                let notificationListData = backupData.notificationList;
                let proxyListData = backupData.proxyList;
                let monitorListData = backupData.monitorList;

                let version17x = compareVersions.compare(backupData.version, "1.7.0", ">=");

                // If the import option is "overwrite" it'll clear most of the tables, except "settings" and "user"
                if (importHandle == "overwrite") {
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
                        if ((importHandle == "skip" && notificationNameListString.includes(notificationListData[i].name) == false) || importHandle == "keep" || importHandle == "overwrite") {

                            let notification = JSON.parse(notificationListData[i].config);
                            await Notification.save(notification, null, socket.userID);

                        }
                    }
                }

                // Only starts importing if the backup file contains at least one proxy
                if (proxyListData.length >= 1) {
                    const proxies = await R.findAll("proxy");

                    // Loop over proxy list and save proxies
                    for (const proxy of proxyListData) {
                        const exists = proxies.find(item => item.id === proxy.id);

                        // Do not process when proxy already exists in import handle is skip and keep
                        if (["skip", "keep"].includes(importHandle) && !exists) {
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
                                basic_auth_user: monitorListData[i].basic_auth_user,
                                basic_auth_pass: monitorListData[i].basic_auth_pass,
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

        socket.on("clearEvents", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                console.log(`Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`);

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

                console.log(`Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`);

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

                console.log(`Clear Statistics User ID: ${socket.userID}`);

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
        cloudflaredSocketHandler(socket);
        databaseSocketHandler(socket);
        proxySocketHandler(socket);

        debug("added all socket handlers");

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        debug("check auto login");
        if (await setting("disableAuth")) {
            console.log("Disabled Auth: auto login to admin");
            afterLogin(socket, await R.findOne("user"));
            socket.emit("autoLogin");
        } else {
            debug("need auth");
        }

    });

    console.log("Init the server");

    httpServer.once("error", async (err) => {
        console.error("Cannot listen: " + err.message);
        await shutdownFunction();
    });

    httpServer.listen(port, hostname, () => {
        if (hostname) {
            console.log(`Listening on ${hostname}:${port}`);
        } else {
            console.log(`Listening on ${port}`);
        }
        startMonitors();
        checkVersion.startInterval();

        if (testMode) {
            startUnitTest();
        }
    });

    initBackgroundJobs(args);

    // Start cloudflared at the end if configured
    await cloudflaredAutoStart(cloudflaredToken);

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

async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id);

    let monitorList = await server.sendMonitorList(socket);
    sendNotificationList(socket);
    sendProxyList(socket);

    await sleep(500);

    await StatusPage.sendStatusPageList(io, socket);

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

async function initDatabase(testMode = false) {
    if (! fs.existsSync(Database.path)) {
        console.log("Copying Database");
        fs.copyFileSync(Database.templatePath, Database.path);
    }

    console.log("Connecting to the Database");
    await Database.connect(testMode);
    console.log("Connected");

    // Patch the database
    await Database.patch();

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
        console.log("No user, need setup");
        needSetup = true;
    }

    jwtSecret = jwtSecretBean.value;
}

async function startMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    console.log(`Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    let monitor = await R.findOne("monitor", " id = ? ", [
        monitorID,
    ]);

    if (monitor.id in server.monitorList) {
        server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    monitor.start(io);
}

async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID);
}

async function pauseMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    console.log(`Pause Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 0 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    if (monitorID in server.monitorList) {
        server.monitorList[monitorID].stop();
    }
}

/**
 * Resume active monitors
 */
async function startMonitors() {
    let list = await R.find("monitor", " active = 1 ");

    for (let monitor of list) {
        server.monitorList[monitor.id] = monitor;
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

    console.log("Stopping all monitors");
    for (let id in server.monitorList) {
        let monitor = server.monitorList[id];
        monitor.stop();
    }
    await sleep(2000);
    await Database.close();

    stopBackgroundJobs();
    await cloudflaredStop();
}

function finalFunction() {
    console.log("Graceful shutdown successful!");
}

gracefulShutdown(httpServer, {
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
