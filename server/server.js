/*
 * Uptime Kuma Server
 * node "server/server.js"
 * DO NOT require("./server") in other modules, it likely creates circular dependency!
 */
console.log("[server/server.js/] Welcome to Uptime Kuma");

// As the log function need to use dayjs, it should be very top
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("./modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

// Load environment variables from `.env`
require("dotenv").config();

// Check Node.js Version
const nodeVersion = parseInt(process.versions.node.split(".")[0]);
const requiredVersion = 14;
console.log(`[server/server.js/] Your Node.js version: ${nodeVersion}`);

if (nodeVersion < requiredVersion) {
    console.error(`Error: Your Node.js version is not supported, please upgrade to Node.js >= ${requiredVersion}.`);
    process.exit(-1);
}

const args = require("args-parser")(process.argv);
const { sleep, log, getRandomInt, genSecret, isDev } = require("../src/util");
const config = require("./config");

log.info("server", "Welcome to Uptime Kuma");
log.debug("server/server.js/", "Arguments");
log.debug("server/server.js/", args);

if (! process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

log.info("server/server.js/", "Node Env: " + process.env.NODE_ENV);

log.info("server/server.js/", "Importing Node libraries");
const fs = require("fs");

log.info("server/server.js/", "Importing 3rd-party libraries");

log.debug("server/server.js/", "Importing express");
const express = require("express");
const expressStaticGzip = require("express-static-gzip");
log.debug("server/server.js/", "Importing redbean-node");
const { R } = require("redbean-node");
log.debug("server/server.js/", "Importing jsonwebtoken");
const jwt = require("jsonwebtoken");
log.debug("server/server.js/", "Importing http-graceful-shutdown");
const gracefulShutdown = require("http-graceful-shutdown");
log.debug("server/server.js/", "Importing prometheus-api-metrics");
const prometheusAPIMetrics = require("prometheus-api-metrics");
log.debug("server/server.js/", "Importing compare-versions");
const compareVersions = require("compare-versions");
const { passwordStrength } = require("check-password-strength");

log.debug("server/server.js/", "Importing 2FA Modules");
const notp = require("notp");
const base32 = require("thirty-two");

const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance(args);
const io = module.exports.io = server.io;
const app = server.app;

log.info("server/server.js/", "Importing this project modules");
log.debug("server/server.js/", "Importing Monitor");
const Monitor = require("./model/monitor");
log.debug("server/server.js/", "Importing Settings");
const { getSettings, setSettings, setting, initJWTSecret, checkLogin, startUnitTest, FBSD, doubleCheckPassword, startE2eTests } = require("./util-server");

log.debug("server/server.js/", "Importing Notification");
const { Notification } = require("./notification");
Notification.init();

log.debug("server/server.js/", "Importing Proxy");
const { Proxy } = require("./proxy");

log.debug("server/server.js/", "Importing Database");
const Database = require("./database");

log.debug("server/server.js/", "Importing Background Jobs");
const { initBackgroundJobs, stopBackgroundJobs } = require("./jobs");
const { loginRateLimiter, twoFaRateLimiter } = require("./rate-limiter");

const { apiAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const checkVersion = require("./check-version");
log.info("server/server.js/", "Version: " + checkVersion.version);

// If host is omitted, the server will accept connections on the unspecified IPv6 address (::) when IPv6 is available and the unspecified IPv4 address (0.0.0.0) otherwise.
// Dual-stack support for (::)
// Also read HOST if not FreeBSD, as HOST is a system environment variable in FreeBSD
let hostEnv = FBSD ? null : process.env.HOST;
let hostname = args.host || process.env.UPTIME_KUMA_HOST || hostEnv;

if (hostname) {
    log.info("server/server.js/", "Custom hostname: " + hostname);
}

const port = [ args.port, process.env.UPTIME_KUMA_PORT, process.env.PORT, 3001 ]
    .map(portValue => parseInt(portValue))
    .find(portValue => !isNaN(portValue));

const disableFrameSameOrigin = !!process.env.UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN || args["disable-frame-sameorigin"] || false;
const cloudflaredToken = args["cloudflared-token"] || process.env.UPTIME_KUMA_CLOUDFLARED_TOKEN || undefined;

// 2FA / notp verification defaults
const twoFAVerifyOptions = {
    "window": 1,
    "time": 30
};

/**
 * Run unit test after the server is ready
 * @type {boolean}
 */
const testMode = !!args["test"] || false;
const e2eTestMode = !!args["e2e"] || false;

if (config.demoMode) {
    log.info("server/server.js/", "==== Demo Mode ====");
}

// Must be after io instantiation
const { sendNotificationList, sendHeartbeatList, sendImportantHeartbeatList, sendInfo, sendProxyList, sendDockerHostList, sendAPIKeyList } = require("./client");
const { statusPageSocketHandler } = require("./socket-handlers/status-page-socket-handler");
const databaseSocketHandler = require("./socket-handlers/database-socket-handler");
const TwoFA = require("./2fa");
const StatusPage = require("./model/status_page");
const { cloudflaredSocketHandler, autoStart: cloudflaredAutoStart, stop: cloudflaredStop } = require("./socket-handlers/cloudflared-socket-handler");
const { proxySocketHandler } = require("./socket-handlers/proxy-socket-handler");
const { dockerSocketHandler } = require("./socket-handlers/docker-socket-handler");
const { maintenanceSocketHandler } = require("./socket-handlers/maintenance-socket-handler");
const { apiKeySocketHandler } = require("./socket-handlers/api-key-socket-handler");
const { generalSocketHandler } = require("./socket-handlers/general-socket-handler");
const { Settings } = require("./settings");
const { CacheableDnsHttpAgent } = require("./cacheable-dns-http-agent");
const { pluginsHandler } = require("./socket-handlers/plugins-handler");
const apicache = require("./modules/apicache");

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
 * Use for decode the auth object
 * @type {null}
 */
let jwtSecret = null;

/**
 * Show Setup Page
 * @type {boolean}
 */
let needSetup = false;

(async () => {

    log.debug("server/server.js/","Start db, api init")

    Database.init(args);
    await initDatabase(testMode);
    await server.initAfterDatabaseReady();
    server.loadPlugins();
    server.entryPage = await Settings.get("entryPage");
    await StatusPage.loadDomainMappingList();

    log.info("server/server.js/", "Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Entry Page
    app.get("/", async (request, response) => {

        log.info("server/server.js/api.get(/)","");

        let hostname = request.hostname;
        if (await setting("trustProxy")) {
            const proxy = request.headers["x-forwarded-host"];
            if (proxy) {
                hostname = proxy;
            }
        }

        log.debug("server/server.js/", `Request Domain: ${hostname}`);

        const uptimeKumaEntryPage = server.entryPage;
        if (hostname in StatusPage.domainMappingList) {

            log.debug("server/server.js/", "This is a status page domain w hostname: " + hostname);

            let slug = StatusPage.domainMappingList[hostname];
            await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);

        } else if (uptimeKumaEntryPage && uptimeKumaEntryPage.startsWith("statusPage-")) {
            log.debug("server/server.js/", "Redirect to status page");
            response.redirect("/status/" + uptimeKumaEntryPage.replace("statusPage-", ""));
        } else {
            log.debug("server/server.js/", "Redirect to dasboard");
            response.redirect("/dashboard");
        }
    });

    if (isDev) {
        log.debug("server/server.js/isDev: true","");
        app.post("/test-webhook", async (request, response) => {
            log.debug("test", request.headers);
            log.debug("test", request.body);
            response.send("OK");
        });
    }

    // Robots.txt
    app.get("/robots.txt", async (_request, response) => {
        log.debug("server/server.js/app.get(.robots.txt)","");
        let txt = "User-agent: *\nDisallow:";
        if (!await setting("searchEngineIndex")) {
            txt += " /";
        }
        response.setHeader("Content-Type", "text/plain");
        response.send(txt);
    });

    // Basic Auth Router here

    // Prometheus API metrics  /metrics
    // With Basic Auth using the first user's username/password
    app.get("/metrics", apiAuth, prometheusAPIMetrics());

    app.use("/", expressStaticGzip("dist", {
        enableBrotli: true,
    }));

    // ./data/upload
    app.use("/upload", express.static(Database.uploadDir));

    app.get("/.well-known/change-password", async (_, response) => {
        response.redirect("https://github.com/louislam/uptime-kuma/wiki/Reset-Password-via-CLI");
    });

    // API Router
    const apiRouter = require("./routers/api-router");
    app.use(apiRouter);
    log.debug("server/server.js/app.use(apiRouter)","");


    // Status Page Router
    const statusPageRouter = require("./routers/status-page-router");
    app.use(statusPageRouter);
    log.debug("server/server.js/app.use(statusPageRouter)","");

    // Universal Route Handler, must be at the end of all express routes.
    app.get("*", async (_request, response) => {
        log.debug("server/server.js/app.get(*)","");
        if (_request.originalUrl.startsWith("/upload/")) {
            response.status(404).send("File not found.");
        } else {
            response.send(server.indexHTML);
        }
    });

    log.info("server/server.js/", "Adding socket handler");
    io.on("connection", async (socket) => {

        log.info("server/server.js/io.on(connection)","");

        sendInfo(socket);

        if (needSetup) {
            log.info("server/server.js/", "Redirect to setup page");
            socket.emit("setup");
            log.info("server/server.js/", "socket.emit(setup)");
        }

        // ***************************
        // Public Socket API
        // ***************************

        socket.on("loginByToken", async (token, callback) => {

            log.info("server/server.js/socket.on.loginByToken(token,callback)","");

            const clientIP = await server.getClientIP(socket);

            log.info("server/server.js/socket.on(loginByToken)", `Login by token. IP=${clientIP}`);

            try {
                let decoded = jwt.verify(token, jwtSecret);

                log.info("server/server.js/socket.on(loginByToken)", "Username from JWT: " + decoded.username);

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ]);
                log.debug("server/server.js/socket.on(loginByToken)",
                `R.findOne("user", " username = ${decoded.username} AND active = 1 "`
                );

                if (user) {
                    log.debug("server/server.js/socket.on(loginByToken)", "afterLogin");
                    afterLogin(socket, user);
                    log.debug("server/server.js/socket.on(loginByToken)", "afterLogin ok");

                    log.info("server/server.js/socket.on(loginByToken)", `Successfully logged in user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                    });
                } else {

                    log.info("server/server.js/socket.on(loginByToken)", `Inactive or deleted user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: false,
                        msg: "The user is inactive or deleted.",
                    });
                }
            } catch (error) {

                log.error("server/server.js/socket.on(loginByToken)", `Invalid token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: "Invalid token.",
                });
            }

        });

        socket.on("login", async (data, callback) => {

            log.error("server/server.js/socket.on.login(data,callback)","");

            const clientIP = await server.getClientIP(socket);

            log.info("server/server.js/socket.on.login(...)", `Login by username + password. IP=${clientIP}`);

            // Checking
            if (typeof callback !== "function") {
                return;
            }

            if (!data) {
                return;
            }

            // Login Rate Limit
            if (! await loginRateLimiter.pass(callback)) {
                log.info("server/server.js/socket.on.login(...)", `Too many failed requests for user ${data.username}. IP=${clientIP}`);
                return;
            }

            let user = await login(data.username, data.password);

            if (user) {
                if (user.twofa_status === 0) {
                    afterLogin(socket, user);

                    log.info("server/server.js/socket.on.login(...)", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                        token: jwt.sign({
                            username: data.username,
                        }, jwtSecret),
                    });
                }

                if (user.twofa_status === 1 && !data.token) {

                    log.info("server/server.js/socket.on.login(...)", `2FA token required for user ${data.username}. IP=${clientIP}`);

                    callback({
                        tokenRequired: true,
                    });
                }

                if (data.token) {
                    let verify = notp.totp.verify(data.token, user.twofa_secret, twoFAVerifyOptions);

                    if (user.twofa_last_token !== data.token && verify) {
                        afterLogin(socket, user);

                        await R.exec("UPDATE `user` SET twofa_last_token = ? WHERE id = ? ", [
                            data.token,
                            socket.userID,
                        ]);
                        log.debug("server/server.js/socket.on.login(...)",
                        `R.exec("UPDATE user SET twofa_last_token = ${data.token} WHERE id = ${socket.userID} ")`
                        );

                        log.info("server/server.js/socket.on.login(...)", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: true,
                            token: jwt.sign({
                                username: data.username,
                            }, jwtSecret),
                        });
                    } else {

                        log.warn("server/server.js/socket.on.login(...)", `Invalid token provided for user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: false,
                            msg: "Invalid Token!",
                        });
                    }
                }
            } else {

                log.warn("server/server.js/socket.on.login(...)", `Incorrect username or password for user ${data.username}. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: "Incorrect username or password.",
                });
            }

        });

        socket.on("logout", async (callback) => {

            log.info("server/server.js/socket.on.logout(callback)","");

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

            log.info("server/server.js/socket.on.prepare2FA(currentPassword, callback)","");

            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);
                log.info("server/server.js/socket.on.prepare2FA(...)","look for user @ db");
                log.debug("server/server.js/socket.on.prepare2FA(...)",
                `R.findOne("user", " id = ${socket.userID} AND active = 1 ")`
                );


                if (user.twofa_status === 0) {
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
                    log.debug("server/server.js/socket.on.prepare2FA(...)",
                      `R.exec("UPDATE user SET twofa_secret = ${newSecret} WHERE id = ${socket.userID} ")`
                    );
                    log.info("server/server.js/socket.on.prepare2FA(...)","update user 2fa secret ? @ db");

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

            log.debug("server/server.js/socket.on.save2Fa(currentPassword, callback)");

            const clientIP = await server.getClientIP(socket);

            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [
                    socket.userID,
                ]);
                log.debug("server/server.js/socket.on.save2FA(...)",
                  `R.exec("UPDATE user SET twofa_status = 1 WHERE id = ${socket.userID} ")`
                );

                log.info("server/server.js/socket.on.save2Fa(...)", `Saved 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2FA Enabled.",
                });
            } catch (error) {

                log.error("server/server.js/socket.on.save2Fa(...)", `Error changing 2FA token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("disable2FA", async (currentPassword, callback) => {

            log.debug("server/server.js/socket.on.disable2FA(currentPassword, callback)");

            const clientIP = await server.getClientIP(socket);

            try {
                if (! await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);
                await TwoFA.disable2FA(socket.userID);

                log.info("server/server.js/socket.on.disable2FA(...)", `Disabled 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2FA Disabled.",
                });
            } catch (error) {

                log.error("server/server.js/socket.on.disable2FA(...)", `Error disabling 2FA token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("verifyToken", async (token, currentPassword, callback) => {

            log.debug("server/server.js/socket.on.verifyToken(token, currentPassword, callback)");

            try {
                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);
                log.debug("server/server.js/socket.on.verifyToken(token, currentPassword, callback)",
                  `R.findOne("user", " id = ${socket.userID} AND active = 1 ")`
                );

                let verify = notp.totp.verify(token, user.twofa_secret, twoFAVerifyOptions);

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

            log.debug("server/server.js/socket.on.twoFAStatus(callback)");

            try {
                checkLogin(socket);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);
                log.debug("server/server.js/socket.on.twoFAStatus(callback)",
                  `R.findOne("user", " id = ${socket.userID} AND active = 1 ")`
                );

                if (user.twofa_status === 1) {
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
                    msg: error.message,
                });
            }
        });

        socket.on("needSetup", async (callback) => {
            log.debug("server/server.js/socket.on.needSetup(callback)");
            callback(needSetup);
        });

        socket.on("setup", async (username, password, callback) => {
            log.debug("server/server.js/socket.on.setup(username, password, callback)");
            try {
                if (passwordStrength(password).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                if ((await R.count("user")) !== 0) {
                    throw new Error("Uptime Kuma has been initialized. If you want to run setup again, please delete the database.");
                }
                log.debug("server/server.js/socket.on.setup(username, password, callback)",
                  `R.count("user")) !== 0)`
                );

                let user = R.dispense("user");
                log.debug("server/server.js/socket.on.setup(username, password, callback)",
                  `R.dispense("user")`
                );
                user.username = username;
                user.password = passwordHash.generate(password);
                await R.store(user);
                log.debug("server/server.js/socket.on.setup(username, password, callback)",
                  `R.store(user)`
                );

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
            log.debug("server/server.js/socket.on.add(monitor,callback)");
            try {
                checkLogin(socket);
                let bean = R.dispense("monitor");
                log.debug("server/server.js/socket.on.add(monitor,callback)",
                  `R.dispense("monitor")`
                );

                let notificationIDList = monitor.notificationIDList;
                delete monitor.notificationIDList;

                monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                delete monitor.accepted_statuscodes;

                bean.import(monitor);
                bean.user_id = socket.userID;

                bean.validate();

                await R.store(bean);
                log.debug("server/server.js/socket.on.add(monitor,callback)",
                  `R.store(bean)`
                );

                await updateMonitorNotification(bean.id, notificationIDList);

                await server.sendMonitorList(socket);
                await startMonitor(socket.userID, bean.id);

                log.info("monitor", `Added Monitor: ${monitor.id} User ID: ${socket.userID}`);

                callback({
                    ok: true,
                    msg: "Added Successfully.",
                    monitorID: bean.id,
                });

            } catch (e) {

                log.error("server/server.js/socket.on.add(...)", `Error adding Monitor: ${monitor.id} User ID: ${socket.userID}`);

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Edit a monitor
        socket.on("editMonitor", async (monitor, callback) => {
            log.error("server/server.js/socket.on.editMonitor(monitor,callback)","");
            try {
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [ monitor.id ]);
                log.debug("server/server.js/socket.on.editMonitor(monitor,callback)",
                  `R.findOne("monitor", " id = ${monitor.id} ")`
                );

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.");
                }

                bean.name = monitor.name;
                bean.description = monitor.description;
                bean.type = monitor.type;
                bean.url = monitor.url;
                bean.method = monitor.method;
                bean.body = monitor.body;
                bean.headers = monitor.headers;
                bean.basic_auth_user = monitor.basic_auth_user;
                bean.basic_auth_pass = monitor.basic_auth_pass;
                bean.tlsCa = monitor.tlsCa;
                bean.tlsCert = monitor.tlsCert;
                bean.tlsKey = monitor.tlsKey;
                bean.interval = monitor.interval;
                bean.retryInterval = monitor.retryInterval;
                bean.resendInterval = monitor.resendInterval;
                bean.hostname = monitor.hostname;
                bean.game = monitor.game;
                bean.maxretries = monitor.maxretries;
                bean.port = parseInt(monitor.port);
                bean.keyword = monitor.keyword;
                bean.ignoreTls = monitor.ignoreTls;
                bean.expiryNotification = monitor.expiryNotification;
                bean.upsideDown = monitor.upsideDown;
                bean.packetSize = monitor.packetSize;
                bean.maxredirects = monitor.maxredirects;
                bean.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                bean.dns_resolve_type = monitor.dns_resolve_type;
                bean.dns_resolve_server = monitor.dns_resolve_server;
                bean.pushToken = monitor.pushToken;
                bean.docker_container = monitor.docker_container;
                bean.docker_host = monitor.docker_host;
                bean.proxyId = Number.isInteger(monitor.proxyId) ? monitor.proxyId : null;
                bean.mqttUsername = monitor.mqttUsername;
                bean.mqttPassword = monitor.mqttPassword;
                bean.mqttTopic = monitor.mqttTopic;
                bean.mqttSuccessMessage = monitor.mqttSuccessMessage;
                bean.databaseConnectionString = monitor.databaseConnectionString;
                bean.databaseQuery = monitor.databaseQuery;
                bean.authMethod = monitor.authMethod;
                bean.authWorkstation = monitor.authWorkstation;
                bean.authDomain = monitor.authDomain;
                bean.grpcUrl = monitor.grpcUrl;
                bean.grpcProtobuf = monitor.grpcProtobuf;
                bean.grpcServiceName = monitor.grpcServiceName;
                bean.grpcMethod = monitor.grpcMethod;
                bean.grpcBody = monitor.grpcBody;
                bean.grpcMetadata = monitor.grpcMetadata;
                bean.grpcEnableTls = monitor.grpcEnableTls;
                bean.radiusUsername = monitor.radiusUsername;
                bean.radiusPassword = monitor.radiusPassword;
                bean.radiusCalledStationId = monitor.radiusCalledStationId;
                bean.radiusCallingStationId = monitor.radiusCallingStationId;
                bean.radiusSecret = monitor.radiusSecret;
                bean.httpBodyEncoding = monitor.httpBodyEncoding;

                bean.validate();

                await R.store(bean);
                log.debug("server/server.js/socket.on.editMonitor(monitor,callback)",
                  `R.store(bean)`
                );

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
                log.error("monitor", e);
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitorList", async (callback) => {
            log.debug("server/server.js/socket.on.getMonitorList(callback)","");
            try {
                checkLogin(socket);
                await server.sendMonitorList(socket);
                callback({
                    ok: true,
                });
            } catch (e) {
                log.error("monitor", e);
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("getMonitor", async (monitorID, callback) => {
            log.debug("server/server.js/socket.on.getMonitor(monitorID,callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.getMonitor(...)", `Get Monitor: ${monitorID} User ID: ${socket.userID}`);

                let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);
                log.debug("server/server.js/socket.on.getMonitor(monitorID,callback)",
                  `R.findOne("monitor", " id = ${monitorID} AND user_id = ${socket.userID} ")`
                );

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
            log.debug("server/server.js/socket.on.getMonitorBeats(monitorID,period,callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.getMonitorBeats(...)", `Get Monitor Beats: ${monitorID} User ID: ${socket.userID}`);

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
                log.debug("server/server.js/socket.on.getMonitorBeats(monitorID,period,callback)",
                `R.getAll(
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ${monitorID} AND
                    time > DATETIME('now', '-' || ${period} || ' hours')
                    ORDER BY time ASC
                `);

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
            log.debug("server/server.js/socket.on.resumeMonitor(monitorID,callback)","");
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
            log.debug("server/server.js/socket.on.pauseMonitor(monitorID,callback)","");
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
            log.debug("server/server.js/socket.on.deleteMonitor(monitorID,callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.deleteMonitor(...)", `Delete Monitor: ${monitorID} User ID: ${socket.userID}`);

                if (monitorID in server.monitorList) {
                    server.monitorList[monitorID].stop();
                    delete server.monitorList[monitorID];
                }

                await R.exec("DELETE FROM monitor WHERE id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);
                log.debug("server/server.js/socket.on.deleteMonitor(monitorID,callback)",
                `R.exec("DELETE FROM monitor WHERE id = ${monitorID} AND user_id = ${socket.userID} ")`);

                // Fix #2880
                apicache.clear();

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
            log.debug("server/server.js/socket.on.getTags(callback)","");
            try {
                checkLogin(socket);

                const list = await R.findAll("tag");
                log.debug("server/server.js/socket.on.getTags(callback)",
                `R.findAll("tag")`);

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
            log.debug("server/server.js/socket.on.addTag(tag,callback)","");
            try {
                checkLogin(socket);

                let bean = R.dispense("tag");
                log.debug("server/server.js/socket.on.addTag(tag,callback)",
                `R.findAll("tag")`);
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);
                log.debug("server/server.js/socket.on.addTag(tag,callback)",
                `R.store(bean)`);

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
            log.debug("server/server.js/socket.on.editTag(tag,callback)","");
            try {
                checkLogin(socket);

                let bean = await R.findOne("tag", " id = ? ", [ tag.id ]);
                log.debug("server/server.js/socket.on.editTag(tag,callback)",
                `R.findOne("tag", " id = ${tag.id} ")`);
                if (bean == null) {
                    callback({
                        ok: false,
                        msg: "Tag not found",
                    });
                    return;
                }
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);
                log.debug("server/server.js/socket.on.editTag(tag,callback)",
                `R.store(bean)`);

                callback({
                    ok: true,
                    msg: "Saved",
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
            log.debug("server/server.js/socket.on.deleteTag(tag,callback)","");
            try {
                checkLogin(socket);

                await R.exec("DELETE FROM tag WHERE id = ? ", [ tagID ]);
                log.debug("server/server.js/socket.on.deleteTag(tag,callback)",
                ` R.exec("DELETE FROM tag WHERE id = ${tagID} ")`);

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
            log.debug("server/server.js/socket.on.addMonitorTag(tagID, monitorID, value, callback)","");
            try {
                checkLogin(socket);

                await R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)", [
                    tagID,
                    monitorID,
                    value,
                ]);
                log.debug("server/server.js/socket.on.addMonitorTag(tagID, monitorID, value, callback)",
                `R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (${tagId}, ${monitorID}, ${value}))"`);

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
            log.debug("server/server.js/socket.on.editMonitorTag(tagID, monitorID, value, callback)","");
            try {
                checkLogin(socket);

                await R.exec("UPDATE monitor_tag SET value = ? WHERE tag_id = ? AND monitor_id = ?", [
                    value,
                    tagID,
                    monitorID,
                ]);
                log.debug("server/server.js/socket.on.editMonitorTag(tagID, monitorID, value, callback)",
                `R.exec("UPDATE monitor_tag SET value = ${value} WHERE tag_id = ${tagID} AND monitor_id = ${monitorID}")`);

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
            log.debug("server/server.js/socket.on.deleteMonitorTag(tagID, monitorID, value, callback)","");
            try {
                checkLogin(socket);

                await R.exec("DELETE FROM monitor_tag WHERE tag_id = ? AND monitor_id = ? AND value = ?", [
                    tagID,
                    monitorID,
                    value,
                ]);
                log.debug("server/server.js/socket.on.deleteMonitorTag(tagID, monitorID, value, callback)",
                `R.exec("DELETE FROM monitor_tag WHERE tag_id = ${tagID} AND monitor_id = ${monitorID} AND value = ${value})`);

                // Cleanup unused Tags
                await R.exec("delete from tag where ( select count(*) from monitor_tag mt where tag.id = mt.tag_id ) = 0");
                log.debug("server/server.js/socket.on.deleteMonitorTag(tagID, monitorID, value, callback)",
                `R.exec("delete from tag where ( select count(*) from monitor_tag mt where tag.id = mt.tag_id ) = 0")`);

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
            log.debug("server/server.js/socket.on.changePassword(password, callback)","");
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
            log.debug("server/server.js/socket.on.getSettings(callback)","");
            try {
                checkLogin(socket);
                const data = await getSettings("general");

                if (!data.serverTimezone) {
                    data.serverTimezone = await server.getTimezone();
                }

                callback({
                    ok: true,
                    data: data,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("setSettings", async (data, currentPassword, callback) => {
            log.debug("server/server.js/socket.on.setSettings(data, currentPassword, callback)","");
            try {
                checkLogin(socket);

                // If currently is disabled auth, don't need to check
                // Disabled Auth + Want to Disable Auth => No Check
                // Disabled Auth + Want to Enable Auth => No Check
                // Enabled Auth + Want to Disable Auth => Check!!
                // Enabled Auth + Want to Enable Auth => No Check
                const currentDisabledAuth = await setting("disableAuth");
                if (!currentDisabledAuth && data.disableAuth) {
                    await doubleCheckPassword(socket, currentPassword);
                }

                await setSettings("general", data);
                server.entryPage = data.entryPage;

                await CacheableDnsHttpAgent.update();

                // Also need to apply timezone globally
                if (data.serverTimezone) {
                    await server.setTimezone(data.serverTimezone);
                }

                callback({
                    ok: true,
                    msg: "Saved"
                });

                sendInfo(socket);
                server.sendMaintenanceList(socket);

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Add or Edit
        socket.on("addNotification", async (notification, notificationID, callback) => {
            log.debug("server/server.js/socket.on.addNotification(notification, notificationID, callback)","");
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
            log.debug("server/server.js/socket.on.deleteNotification(notificationID, callback)","");
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
            log.debug("server/server.js/socket.on.testNotification(notification, callback)","");
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
            log.debug("server/server.js/socket.on.checkApprise(callback)","");
            try {
                checkLogin(socket);
                callback(Notification.checkApprise());
            } catch (e) {
                callback(false);
            }
        });

        socket.on("uploadBackup", async (uploadedJSON, importHandle, callback) => {
            log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)","");
            try {
                checkLogin(socket);

                let backupData = JSON.parse(uploadedJSON);

                log.info("server/server.js/socket.on.uploadBackup(...)", `Importing Backup, User ID: ${socket.userID}, Version: ${backupData.version}`);

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
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM heartbeat")`);
                    await R.exec("DELETE FROM monitor_notification");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM monitor_notification")`);
                    await R.exec("DELETE FROM monitor_tls_info");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM monitor_tls_info")`);
                    await R.exec("DELETE FROM notification");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM notification")`);
                    await R.exec("DELETE FROM monitor_tag");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM monitor_tag")`);
                    await R.exec("DELETE FROM tag");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM tag")`);
                    await R.exec("DELETE FROM monitor");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM monitor")`);
                    await R.exec("DELETE FROM proxy");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.exec("DELETE FROM proxy")`);
                }

                // Only starts importing if the backup file contains at least one notification
                if (notificationListData.length >= 1) {
                    // Get every existing notification name and puts them in one simple string
                    let notificationNameList = await R.getAll("SELECT name FROM notification");
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.getAll("SELECT name FROM notification")`);
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
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.findAll("proxy")`);

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
                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                    `R.getAll("SELECT name FROM monitor")`);
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
                                description: monitorListData[i].description,
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
                            log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                            `R.dispense("monitor")`);

                            let notificationIDList = monitor.notificationIDList;
                            delete monitor.notificationIDList;

                            monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                            delete monitor.accepted_statuscodes;

                            bean.import(monitor);
                            bean.user_id = socket.userID;
                            await R.store(bean);
                            log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                            `R.store(bean)`);

                            // Only for backup files with the version 1.7.0 or higher, since there was the tag feature implemented
                            if (version17x) {
                                // Only import if the specific monitor has tags assigned
                                for (const oldTag of monitorListData[i].tags) {

                                    // Check if tag already exists and get data ->
                                    let tag = await R.findOne("tag", " name = ?", [
                                        oldTag.name,
                                    ]);
                                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                                    `R.findOne("tag", " name = ${oldTag.name}")`);

                                    let tagId;
                                    if (! tag) {
                                        // -> If it doesn't exist, create new tag from backup file
                                        let beanTag = R.dispense("tag");
                                        log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                                        `R.dispense("tag")`);
                                        beanTag.name = oldTag.name;
                                        beanTag.color = oldTag.color;
                                        await R.store(beanTag);
                                        log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                                        `R.store(beanTag)`);

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
                                    log.debug("server/server.js/socket.on.uploadBackup(uploadedJSON, importHandle, callback)",
                                    `R.exec("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (${tagId}, ${bean.id}, ${oldTag.value})")`);

                                }
                            }

                            await updateMonitorNotification(bean.id, notificationIDList);

                            // If monitor was active start it immediately, otherwise pause it
                            if (monitorListData[i].active === 1) {
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
            log.debug("server/server.js/socket.on.clearEvents(monitorID, callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.clearEvents(...)", `Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`);

                await R.exec("UPDATE heartbeat SET msg = ?, important = ? WHERE monitor_id = ? ", [
                    "",
                    "0",
                    monitorID,
                ]);
                log.debug("server/server.js/socket.on.clearEvents(monitorID, callback)",
                `await R.exec("UPDATE heartbeat SET msg = "", important = 0 WHERE monitor_id = ${monitorID}")`
                );

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
            log.debug("server/server.js/socket.on.clearHeartbeats(monitorID, callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.clearHeartbeats(...)", `Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`);

                await R.exec("DELETE FROM heartbeat WHERE monitor_id = ?", [
                    monitorID
                ]);
                log.debug("server/server.js/socket.on.clearHeartbeats(monitorID, callback)",
                ` R.exec("DELETE FROM heartbeat WHERE monitor_id = ${monitorID}")`);

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
            log.debug("server/server.js/socket.on.clearStatistics(callback)","");
            try {
                checkLogin(socket);

                log.info("server/server.js/socket.on.clearStatistics(...)", `Clear Statistics User ID: ${socket.userID}`);

                await R.exec("DELETE FROM heartbeat");
                log.debug("server/server.js/socket.on.clearStatistics(callback)",
                `R.exec("DELETE FROM heartbeat")`);

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
        dockerSocketHandler(socket);
        maintenanceSocketHandler(socket);
        apiKeySocketHandler(socket);
        generalSocketHandler(socket, server);
        pluginsHandler(socket, server);

        log.debug("server/server.js", "added all socket handlers");

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        log.debug("server/server.js", "check auto login");
        if (await setting("disableAuth")) {
            log.info("server/server.js", "Disabled Auth: auto login to admin");
            afterLogin(socket, await R.findOne("user"));
            log.debug("server/server.js",
            `R.findOne("user")`
            );
            socket.emit("autoLogin");
        } else {
            log.debug("server/server.js", "need auth");
        }

    });

    log.info("server/server.js", "Init the server");

    server.httpServer.once("error", async (err) => {
        console.error("[server/server.js] Cannot listen: " + err.message);
        await shutdownFunction();
    });

    server.httpServer.listen(port, hostname, () => {
        if (hostname) {
            log.info("server/server.js", `Listening on ${hostname}:${port}`);
        } else {
            log.info("server/server.js", `Listening on ${port}`);
        }
        startMonitors();
        checkVersion.startInterval();

        if (testMode) {
            startUnitTest();
        }

        if (e2eTestMode) {
            startE2eTests();
        }
    });

    initBackgroundJobs(args);

    // Start cloudflared at the end if configured
    await cloudflaredAutoStart(cloudflaredToken);

})();

/**
 * Update notifications for a given monitor
 * @param {number} monitorID ID of monitor to update
 * @param {number[]} notificationIDList List of new notification
 * providers to add
 * @returns {Promise<void>}
 */
async function updateMonitorNotification(monitorID, notificationIDList) {
    log.info("server/server.js/updateMonitorNotification(monitorID, notificationIDList)", "");
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [
        monitorID,
    ]);
    log.info("server/server.js/updateMonitorNotification(monitorID, notificationIDList)",
    `R.exec("DELETE FROM monitor_notification WHERE monitor_id = ${monitorID} ")`);

    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            log.info("server/server.js/updateMonitorNotification(monitorID, notificationIDList)",
            `R.dispense("monitor_notification")`);
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation);
            log.info("server/server.js/updateMonitorNotification(monitorID, notificationIDList)",
            `R.store(relation)`);
        }
    }
}

/**
 * Check if a given user owns a specific monitor
 * @param {number} userID
 * @param {number} monitorID
 * @returns {Promise<void>}
 * @throws {Error} The specified user does not own the monitor
 */
async function checkOwner(userID, monitorID) {
    log.info("server/server.js/checkOwner(userID, monitorID)", "");
    let row = await R.getRow("SELECT id FROM monitor WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);
    log.info("server/server.js/checkOwner(userID, monitorID)",
    `R.getRow("SELECT id FROM monitor WHERE id = ${monitorID} AND user_id = ${userID} ")`);

    if (! row) {
        throw new Error("You do not own this monitor.");
    }
}

/**
 * Function called after user login
 * This function is used to send the heartbeat list of a monitor.
 * @param {Socket} socket Socket.io instance
 * @param {Object} user User object
 * @returns {Promise<void>}
 */
async function afterLogin(socket, user) {
    log.info("server/server.js/afterLogin(socket, user)", "");
    socket.userID = user.id;
    socket.join(user.id);

    let monitorList = await server.sendMonitorList(socket);
    server.sendMaintenanceList(socket);
    sendNotificationList(socket);
    sendProxyList(socket);
    sendDockerHostList(socket);
    sendAPIKeyList(socket);

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

    // Set server timezone from client browser if not set
    // It should be run once only
    if (! await Settings.get("initServerTimezone")) {
        log.debug("server/server.js/afterLogin(...)", "emit initServerTimezone");
        socket.emit("initServerTimezone");
    }
}

/**
 * Initialize the database
 * @param {boolean} [testMode=false] Should the connection be
 * started in test mode?
 * @returns {Promise<void>}
 */
async function initDatabase(testMode = false) {
    log.info("server/server.js/initDatabase(...)", "");
    if (! fs.existsSync(Database.path)) {
        log.info("server/server.js/initDatabase(...)", "Copying Database");
        fs.copyFileSync(Database.templatePath, Database.path);
    }

    log.info("server/server.js/initDatabase(...)", "Connecting to the Database");
    await Database.connect(testMode);
    log.info("server/server.js/initDatabase(...)", "Connected");

    // Patch the database
    await Database.patch();

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);
    log.info("server/server.js/initDatabase(...)",
    `R.findOne("setting", " key = jwtSecret ")`);

    if (! jwtSecretBean) {
        log.info("server/server.js/initDatabase(...)", "JWT secret is not found, generate one.");
        jwtSecretBean = await initJWTSecret();
        log.info("server/server.js/initDatabase(...)", "Stored JWT secret into database");
    } else {
        log.info("server/server.js/initDatabase(...)", "Load JWT secret from database.");
    }

    // If there is no record in user table, it is a new Uptime Kuma instance, need to setup
    if ((await R.count("user")) === 0) {
        log.info("server/server.js/initDatabase(...)", "No user, need setup");
        needSetup = true;
    }
    log.info("server/server.js/initDatabase(...)",
    `R.count("user")) === 0`);

    jwtSecret = jwtSecretBean.value;
}

/**
 * Start the specified monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function startMonitor(userID, monitorID) {
    log.info("server/server.js/startMonitor(userID, monitorID)", "");
    await checkOwner(userID, monitorID);

    log.info("server/server.js/startMonitor(...)", `Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);
    log.info("server/server.js/startMonitor(userID, monitorID)",
    ` R.exec("UPDATE monitor SET active = 1 WHERE id = ${monitorID} AND user_id = ${userID} ")`);

    let monitor = await R.findOne("monitor", " id = ? ", [
        monitorID,
    ]);
    log.info("server/server.js/startMonitor(userID, monitorID)",
    `R.findOne("monitor", " id = ${monitorID} ")`);

    if (monitor.id in server.monitorList) {
        server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    monitor.start(io);
}

/**
 * Restart a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function restartMonitor(userID, monitorID) {
    log.info("server/server.js/restartMonitor(userID, monitorID)", "");
    return await startMonitor(userID, monitorID);
}

/**
 * Pause a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function pauseMonitor(userID, monitorID) {
    log.info("server/server.js/pauseMonitor(userID, monitorID)", "");
    await checkOwner(userID, monitorID);

    log.info("server/server.js/pauseMonitor(...)", `Pause Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 0 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);
    log.info("server/server.js/pauseMonitor(userID, monitorID)",
    ` R.exec("UPDATE monitor SET active = 0 WHERE id = ${monitorID} AND user_id = ${userID} ")`);

    if (monitorID in server.monitorList) {
        server.monitorList[monitorID].stop();
    }
}

/** Resume active monitors */
async function startMonitors() {
    log.info("server/server.js/startMonitors()", "");
    let list = await R.find("monitor", " active = 1 ");
      log.info("server/server.js/startMonitors()",
      `R.find("monitor", " active = 1 ")`);

    for (let monitor of list) {
        server.monitorList[monitor.id] = monitor;
    }

    for (let monitor of list) {
        monitor.start(io);
        // Give some delays, so all monitors won't make request at the same moment when just start the server.
        await sleep(getRandomInt(300, 1000));
    }
}

/**
 * Shutdown the application
 * Stops all monitors and closes the database connection.
 * @param {string} signal The signal that triggered this function to be called.
 * @returns {Promise<void>}
 */
async function shutdownFunction(signal) {
    log.info("server/server.js/shutdownFunction(signal)", "");
    log.info("server/server.js/shutdownFunction(...)", "Shutdown requested");
    log.info("server/server.js/shutdownFunction(...)", "Called signal: " + signal);

    await server.stop();

    log.info("server/server.js/shutdownFunction(...)", "Stopping all monitors");
    for (let id in server.monitorList) {
        let monitor = server.monitorList[id];
        monitor.stop();
    }
    await sleep(2000);
    await Database.close();

    stopBackgroundJobs();
    await cloudflaredStop();
    Settings.stopCacheCleaner();
}

/** Final function called before application exits */
function finalFunction() {
    log.info("server/server.js/finalFunction()", "Graceful shutdown successful!");
}

gracefulShutdown(server.httpServer, {
    signals: "SIGINT SIGTERM",
    timeout: 30000,                   // timeout: 30 secs
    development: false,               // not in dev mode
    forceExit: true,                  // triggers process.exit() at the end of shutdown process
    onShutdown: shutdownFunction,     // shutdown function (async) - e.g. for cleanup DB, ...
    finally: finalFunction,            // finally function (sync) - e.g. for logging
});

// Catch unexpected errors here
process.addListener("unhandledRejection", (error, promise) => {
    log.info("server/server.js/process.addListener.unhandledRejection(error, promise)", "");
    console.trace(error);
    UptimeKumaServer.errorLog(error, false);
    console.error("[server/server.js/process.addListener.unhandledRejection(...)] If you keep encountering errors, please report to https://github.com/louislam/uptime-kuma/issues");
});
