/*
 * Uptime Kuma Server
 * node "server/server.js"
 * DO NOT require("./server") in other modules, it likely creates circular dependency!
 */
console.log("Welcome to Uptime Kuma");

// As the log function need to use dayjs, it should be very top
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("./modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

// Load environment variables from `.env`
require("dotenv").config();

// Check Node.js Version
const nodeVersion = process.versions.node;

// Get the required Node.js version from package.json
const requiredNodeVersions = require("../package.json").engines.node;
const bannedNodeVersions = " < 18 || 20.0.* || 20.1.* || 20.2.* || 20.3.* ";
console.log(`Your Node.js version: ${nodeVersion}`);

const semver = require("semver");
const requiredNodeVersionsComma = requiredNodeVersions.split("||").map((version) => version.trim()).join(", ");

// Exit Uptime Kuma immediately if the Node.js version is banned
if (semver.satisfies(nodeVersion, bannedNodeVersions)) {
    console.error("\x1b[31m%s\x1b[0m", `Error: Your Node.js version: ${nodeVersion} is not supported, please upgrade your Node.js to ${requiredNodeVersionsComma}.`);
    process.exit(-1);
}

// Warning if the Node.js version is not in the support list, but it maybe still works
if (!semver.satisfies(nodeVersion, requiredNodeVersions)) {
    console.warn("\x1b[31m%s\x1b[0m", `Warning: Your Node.js version: ${nodeVersion} is not officially supported, please upgrade your Node.js to ${requiredNodeVersionsComma}.`);
}

const args = require("args-parser")(process.argv);
const { sleep, log, getRandomInt, genSecret, isDev } = require("../src/util");
const config = require("./config");

log.debug("server", "Arguments");
log.debug("server", args);

if (! process.env.NODE_ENV) {
    process.env.NODE_ENV = "production";
}

if (!process.env.UPTIME_KUMA_WS_ORIGIN_CHECK) {
    process.env.UPTIME_KUMA_WS_ORIGIN_CHECK = "cors-like";
}

log.info("server", "Env: " + process.env.NODE_ENV);
log.debug("server", "Inside Container: " + (process.env.UPTIME_KUMA_IS_CONTAINER === "1"));

if (process.env.UPTIME_KUMA_WS_ORIGIN_CHECK === "bypass") {
    log.warn("server", "WebSocket Origin Check: " + process.env.UPTIME_KUMA_WS_ORIGIN_CHECK);
}

const checkVersion = require("./check-version");
log.info("server", "Uptime Kuma Version: " + checkVersion.version);

log.info("server", "Loading modules");

log.debug("server", "Importing express");
const express = require("express");
const expressStaticGzip = require("express-static-gzip");
log.debug("server", "Importing redbean-node");
const { R } = require("redbean-node");
log.debug("server", "Importing jsonwebtoken");
const jwt = require("jsonwebtoken");
log.debug("server", "Importing http-graceful-shutdown");
const gracefulShutdown = require("http-graceful-shutdown");
log.debug("server", "Importing prometheus-api-metrics");
const prometheusAPIMetrics = require("prometheus-api-metrics");
const { passwordStrength } = require("check-password-strength");

log.debug("server", "Importing 2FA Modules");
const notp = require("notp");
const base32 = require("thirty-two");

const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = module.exports.io = server.io;
const app = server.app;

log.debug("server", "Importing Monitor");
const Monitor = require("./model/monitor");
const User = require("./model/user");

log.debug("server", "Importing Settings");
const { getSettings, setSettings, setting, initJWTSecret, checkLogin, doubleCheckPassword, shake256, SHAKE256_LENGTH, allowDevAllOrigin,
} = require("./util-server");

log.debug("server", "Importing Notification");
const { Notification } = require("./notification");
Notification.init();

log.debug("server", "Importing Database");
const Database = require("./database");

log.debug("server", "Importing Background Jobs");
const { initBackgroundJobs, stopBackgroundJobs } = require("./jobs");
const { loginRateLimiter, twoFaRateLimiter } = require("./rate-limiter");

const { apiAuth } = require("./auth");
const { login } = require("./auth");
const passwordHash = require("./password-hash");

const hostname = config.hostname;

if (hostname) {
    log.info("server", "Custom hostname: " + hostname);
}

const port = config.port;

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

// Must be after io instantiation
const { sendNotificationList, sendHeartbeatList, sendInfo, sendProxyList, sendDockerHostList, sendAPIKeyList, sendRemoteBrowserList, sendMonitorTypeList } = require("./client");
const { statusPageSocketHandler } = require("./socket-handlers/status-page-socket-handler");
const { databaseSocketHandler } = require("./socket-handlers/database-socket-handler");
const { remoteBrowserSocketHandler } = require("./socket-handlers/remote-browser-socket-handler");
const TwoFA = require("./2fa");
const StatusPage = require("./model/status_page");
const { cloudflaredSocketHandler, autoStart: cloudflaredAutoStart, stop: cloudflaredStop } = require("./socket-handlers/cloudflared-socket-handler");
const { proxySocketHandler } = require("./socket-handlers/proxy-socket-handler");
const { dockerSocketHandler } = require("./socket-handlers/docker-socket-handler");
const { maintenanceSocketHandler } = require("./socket-handlers/maintenance-socket-handler");
const { apiKeySocketHandler } = require("./socket-handlers/api-key-socket-handler");
const { generalSocketHandler } = require("./socket-handlers/general-socket-handler");
const { Settings } = require("./settings");
const apicache = require("./modules/apicache");
const { resetChrome } = require("./monitor-types/real-browser-monitor-type");
const { EmbeddedMariaDB } = require("./embedded-mariadb");
const { SetupDatabase } = require("./setup-database");
const { chartSocketHandler } = require("./socket-handlers/chart-socket-handler");

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
 * Show Setup Page
 * @type {boolean}
 */
let needSetup = false;

(async () => {
    // Create a data directory
    Database.initDataDir(args);

    // Check if is chosen a database type
    let setupDatabase = new SetupDatabase(args, server);
    if (setupDatabase.isNeedSetup()) {
        // Hold here and start a special setup page until user choose a database type
        await setupDatabase.start(hostname, port);
    }

    // Connect to database
    try {
        await initDatabase(testMode);
    } catch (e) {
        log.error("server", "Failed to prepare your database: " + e.message);
        process.exit(1);
    }

    // Database should be ready now
    await server.initAfterDatabaseReady();
    server.entryPage = await Settings.get("entryPage");
    await StatusPage.loadDomainMappingList();

    log.debug("server", "Adding route");

    // ***************************
    // Normal Router here
    // ***************************

    // Entry Page
    app.get("/", async (request, response) => {
        let hostname = request.hostname;
        if (await setting("trustProxy")) {
            const proxy = request.headers["x-forwarded-host"];
            if (proxy) {
                hostname = proxy;
            }
        }

        log.debug("entry", `Request Domain: ${hostname}`);

        const uptimeKumaEntryPage = server.entryPage;
        if (hostname in StatusPage.domainMappingList) {
            log.debug("entry", "This is a status page domain");

            let slug = StatusPage.domainMappingList[hostname];
            await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);

        } else if (uptimeKumaEntryPage && uptimeKumaEntryPage.startsWith("statusPage-")) {
            response.redirect("/status/" + uptimeKumaEntryPage.replace("statusPage-", ""));

        } else {
            response.redirect("/dashboard");
        }
    });

    app.get("/setup-database-info", (request, response) => {
        allowDevAllOrigin(response);
        response.json({
            runningSetup: false,
            needSetup: false,
        });
    });

    if (isDev) {
        app.use(express.urlencoded({ extended: true }));
        app.post("/test-webhook", async (request, response) => {
            log.debug("test", request.headers);
            log.debug("test", request.body);
            response.send("OK");
        });

        app.post("/test-x-www-form-urlencoded", async (request, response) => {
            log.debug("test", request.headers);
            log.debug("test", request.body);
            response.send("OK");
        });

        const fs = require("fs");

        app.get("/_e2e/take-sqlite-snapshot", async (request, response) => {
            await Database.close();
            try {
                fs.cpSync(Database.sqlitePath, `${Database.sqlitePath}.e2e-snapshot`);
            } catch (err) {
                throw new Error("Unable to copy SQLite DB.");
            }
            await Database.connect();

            response.send("Snapshot taken.");
        });

        app.get("/_e2e/restore-sqlite-snapshot", async (request, response) => {
            if (!fs.existsSync(`${Database.sqlitePath}.e2e-snapshot`)) {
                throw new Error("Snapshot doesn't exist.");
            }

            await Database.close();
            try {
                fs.cpSync(`${Database.sqlitePath}.e2e-snapshot`, Database.sqlitePath);
            } catch (err) {
                throw new Error("Unable to copy snapshot file.");
            }
            await Database.connect();

            response.send("Snapshot restored.");
        });
    }

    // Robots.txt
    app.get("/robots.txt", async (_request, response) => {
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

    // Status Page Router
    const statusPageRouter = require("./routers/status-page-router");
    app.use(statusPageRouter);

    // Universal Route Handler, must be at the end of all express routes.
    app.get("*", async (_request, response) => {
        if (_request.originalUrl.startsWith("/upload/")) {
            response.status(404).send("File not found.");
        } else {
            response.send(server.indexHTML);
        }
    });

    log.debug("server", "Adding socket handler");
    io.on("connection", async (socket) => {

        await sendInfo(socket, true);

        if (needSetup) {
            log.info("server", "Redirect to setup page");
            socket.emit("setup");
        }

        // ***************************
        // Public Socket API
        // ***************************

        socket.on("loginByToken", async (token, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by token. IP=${clientIP}`);

            try {
                let decoded = jwt.verify(token, server.jwtSecret);

                log.info("auth", "Username from JWT: " + decoded.username);

                let user = await R.findOne("user", " username = ? AND active = 1 ", [
                    decoded.username,
                ]);

                if (user) {
                    // Check if the password changed
                    if (decoded.h !== shake256(user.password, SHAKE256_LENGTH)) {
                        throw new Error("The token is invalid due to password change or old token");
                    }

                    log.debug("auth", "afterLogin");
                    await afterLogin(socket, user);
                    log.debug("auth", "afterLogin ok");

                    log.info("auth", `Successfully logged in user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                    });
                } else {

                    log.info("auth", `Inactive or deleted user ${decoded.username}. IP=${clientIP}`);

                    callback({
                        ok: false,
                        msg: "authUserInactiveOrDeleted",
                        msgi18n: true,
                    });
                }
            } catch (error) {
                log.error("auth", `Invalid token. IP=${clientIP}`);
                if (error.message) {
                    log.error("auth", error.message, `IP=${clientIP}`);
                }
                callback({
                    ok: false,
                    msg: "authInvalidToken",
                    msgi18n: true,
                });
            }

        });

        socket.on("login", async (data, callback) => {
            const clientIP = await server.getClientIP(socket);

            log.info("auth", `Login by username + password. IP=${clientIP}`);

            // Checking
            if (typeof callback !== "function") {
                return;
            }

            if (!data) {
                return;
            }

            // Login Rate Limit
            if (!await loginRateLimiter.pass(callback)) {
                log.info("auth", `Too many failed requests for user ${data.username}. IP=${clientIP}`);
                return;
            }

            let user = await login(data.username, data.password);

            if (user) {
                if (user.twofa_status === 0) {
                    await afterLogin(socket, user);

                    log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                    callback({
                        ok: true,
                        token: User.createJWT(user, server.jwtSecret),
                    });
                }

                if (user.twofa_status === 1 && !data.token) {

                    log.info("auth", `2FA token required for user ${data.username}. IP=${clientIP}`);

                    callback({
                        tokenRequired: true,
                    });
                }

                if (data.token) {
                    let verify = notp.totp.verify(data.token, user.twofa_secret, twoFAVerifyOptions);

                    if (user.twofa_last_token !== data.token && verify) {
                        await afterLogin(socket, user);

                        await R.exec("UPDATE `user` SET twofa_last_token = ? WHERE id = ? ", [
                            data.token,
                            socket.userID,
                        ]);

                        log.info("auth", `Successfully logged in user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: true,
                            token: User.createJWT(user, server.jwtSecret),
                        });
                    } else {

                        log.warn("auth", `Invalid token provided for user ${data.username}. IP=${clientIP}`);

                        callback({
                            ok: false,
                            msg: "authInvalidToken",
                            msgi18n: true,
                        });
                    }
                }
            } else {

                log.warn("auth", `Incorrect username or password for user ${data.username}. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: "authIncorrectCreds",
                    msgi18n: true,
                });
            }

        });

        socket.on("logout", async (callback) => {
            // Rate Limit
            if (!await loginRateLimiter.pass(callback)) {
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
                if (!await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                let user = await R.findOne("user", " id = ? AND active = 1 ", [
                    socket.userID,
                ]);

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

                    callback({
                        ok: true,
                        uri: uri,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "2faAlreadyEnabled",
                        msgi18n: true,
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
            const clientIP = await server.getClientIP(socket);

            try {
                if (!await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);

                await R.exec("UPDATE `user` SET twofa_status = 1 WHERE id = ? ", [
                    socket.userID,
                ]);

                log.info("auth", `Saved 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2faEnabled",
                    msgi18n: true,
                });
            } catch (error) {

                log.error("auth", `Error changing 2FA token. IP=${clientIP}`);

                callback({
                    ok: false,
                    msg: error.message,
                });
            }
        });

        socket.on("disable2FA", async (currentPassword, callback) => {
            const clientIP = await server.getClientIP(socket);

            try {
                if (!await twoFaRateLimiter.pass(callback)) {
                    return;
                }

                checkLogin(socket);
                await doubleCheckPassword(socket, currentPassword);
                await TwoFA.disable2FA(socket.userID);

                log.info("auth", `Disabled 2FA token. IP=${clientIP}`);

                callback({
                    ok: true,
                    msg: "2faDisabled",
                    msgi18n: true,
                });
            } catch (error) {

                log.error("auth", `Error disabling 2FA token. IP=${clientIP}`);

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

                let verify = notp.totp.verify(token, user.twofa_secret, twoFAVerifyOptions);

                if (user.twofa_last_token !== token && verify) {
                    callback({
                        ok: true,
                        valid: true,
                    });
                } else {
                    callback({
                        ok: false,
                        msg: "authInvalidToken",
                        msgi18n: true,
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
            callback(needSetup);
        });

        socket.on("setup", async (username, password, callback) => {
            try {
                if (passwordStrength(password).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                if ((await R.knex("user").count("id as count").first()).count !== 0) {
                    throw new Error("Uptime Kuma has been initialized. If you want to run setup again, please delete the database.");
                }

                let user = R.dispense("user");
                user.username = username;
                user.password = await passwordHash.generate(password);
                await R.store(user);

                needSetup = false;

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

                // Ensure status code ranges are strings
                if (!monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                    throw new Error("Accepted status codes are not all strings");
                }
                monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
                delete monitor.accepted_statuscodes;

                monitor.kafkaProducerBrokers = JSON.stringify(monitor.kafkaProducerBrokers);
                monitor.kafkaProducerSaslOptions = JSON.stringify(monitor.kafkaProducerSaslOptions);

                monitor.conditions = JSON.stringify(monitor.conditions);

                monitor.rabbitmqNodes = JSON.stringify(monitor.rabbitmqNodes);

                /*
                 * List of frontend-only properties that should not be saved to the database.
                 * Should clean up before saving to the database.
                 */
                const frontendOnlyProperties = [ "humanReadableInterval" ];
                for (const prop of frontendOnlyProperties) {
                    if (prop in monitor) {
                        delete monitor[prop];
                    }
                }

                bean.import(monitor);
                bean.user_id = socket.userID;

                bean.validate();

                await R.store(bean);

                await updateMonitorNotification(bean.id, notificationIDList);

                await server.sendUpdateMonitorIntoList(socket, bean.id);

                if (monitor.active !== false) {
                    await startMonitor(socket.userID, bean.id);
                }

                log.info("monitor", `Added Monitor: ${bean.id} User ID: ${socket.userID}`);

                callback({
                    ok: true,
                    msg: "successAdded",
                    msgi18n: true,
                    monitorID: bean.id,
                });

            } catch (e) {

                log.error("monitor", `Error adding Monitor: ${monitor.id} User ID: ${socket.userID}`);

                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        // Edit a monitor
        socket.on("editMonitor", async (monitor, callback) => {
            try {
                let removeGroupChildren = false;
                checkLogin(socket);

                let bean = await R.findOne("monitor", " id = ? ", [ monitor.id ]);

                if (bean.user_id !== socket.userID) {
                    throw new Error("Permission denied.");
                }

                // Check if Parent is Descendant (would cause endless loop)
                if (monitor.parent !== null) {
                    const childIDs = await Monitor.getAllChildrenIDs(monitor.id);
                    if (childIDs.includes(monitor.parent)) {
                        throw new Error("Invalid Monitor Group");
                    }
                }

                // Remove children if monitor type has changed (from group to non-group)
                if (bean.type === "group" && monitor.type !== bean.type) {
                    removeGroupChildren = true;
                }

                // Ensure status code ranges are strings
                if (!monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                    throw new Error("Accepted status codes are not all strings");
                }

                bean.name = monitor.name;
                bean.description = monitor.description;
                bean.parent = monitor.parent;
                bean.type = monitor.type;
                bean.url = monitor.url;
                bean.method = monitor.method;
                bean.body = monitor.body;
                bean.ipFamily = monitor.ipFamily;
                bean.headers = monitor.headers;
                bean.basic_auth_user = monitor.basic_auth_user;
                bean.basic_auth_pass = monitor.basic_auth_pass;
                bean.timeout = monitor.timeout;
                bean.oauth_client_id = monitor.oauth_client_id;
                bean.oauth_client_secret = monitor.oauth_client_secret;
                bean.oauth_auth_method = monitor.oauth_auth_method;
                bean.oauth_token_url = monitor.oauth_token_url;
                bean.oauth_scopes = monitor.oauth_scopes;
                bean.oauth_audience = monitor.oauth_audience;
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

                if (isNaN(bean.port)) {
                    bean.port = null;
                }

                bean.keyword = monitor.keyword;
                bean.invertKeyword = monitor.invertKeyword;
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
                bean.mqttCheckType = monitor.mqttCheckType;
                bean.mqttWebsocketPath = monitor.mqttWebsocketPath;
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
                bean.expectedValue = monitor.expectedValue;
                bean.jsonPath = monitor.jsonPath;
                bean.kafkaProducerTopic = monitor.kafkaProducerTopic;
                bean.kafkaProducerBrokers = JSON.stringify(monitor.kafkaProducerBrokers);
                bean.kafkaProducerAllowAutoTopicCreation = monitor.kafkaProducerAllowAutoTopicCreation;
                bean.kafkaProducerSaslOptions = JSON.stringify(monitor.kafkaProducerSaslOptions);
                bean.kafkaProducerMessage = monitor.kafkaProducerMessage;
                bean.cacheBust = monitor.cacheBust;
                bean.kafkaProducerSsl = monitor.kafkaProducerSsl;
                bean.kafkaProducerAllowAutoTopicCreation =
                    monitor.kafkaProducerAllowAutoTopicCreation;
                bean.gamedigGivenPortOnly = monitor.gamedigGivenPortOnly;
                bean.remote_browser = monitor.remote_browser;
                bean.smtpSecurity = monitor.smtpSecurity;
                bean.snmpVersion = monitor.snmpVersion;
                bean.snmpOid = monitor.snmpOid;
                bean.jsonPathOperator = monitor.jsonPathOperator;
                bean.timeout = monitor.timeout;
                bean.rabbitmqNodes = JSON.stringify(monitor.rabbitmqNodes);
                bean.rabbitmqUsername = monitor.rabbitmqUsername;
                bean.rabbitmqPassword = monitor.rabbitmqPassword;
                bean.conditions = JSON.stringify(monitor.conditions);
                bean.manual_status = monitor.manual_status;

                // ping advanced options
                bean.ping_numeric = monitor.ping_numeric;
                bean.ping_count = monitor.ping_count;
                bean.ping_per_request_timeout = monitor.ping_per_request_timeout;

                bean.validate();

                await R.store(bean);

                if (removeGroupChildren) {
                    await Monitor.unlinkAllChildren(monitor.id);
                }

                await updateMonitorNotification(bean.id, monitor.notificationIDList);

                if (await Monitor.isActive(bean.id, bean.active)) {
                    await restartMonitor(socket.userID, bean.id);
                }

                await server.sendUpdateMonitorIntoList(socket, bean.id);

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
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
            try {
                checkLogin(socket);

                log.info("monitor", `Get Monitor: ${monitorID} User ID: ${socket.userID}`);

                let monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);
                const monitorData = [{ id: monitor.id,
                    active: monitor.active
                }];
                const preloadData = await Monitor.preparePreloadData(monitorData);
                callback({
                    ok: true,
                    monitor: monitor.toJSON(preloadData),
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

                log.info("monitor", `Get Monitor Beats: ${monitorID} User ID: ${socket.userID}`);

                if (period == null) {
                    throw new Error("Invalid period.");
                }

                const sqlHourOffset = Database.sqlHourOffset();

                let list = await R.getAll(`
                    SELECT *
                    FROM heartbeat
                    WHERE monitor_id = ?
                      AND time > ${sqlHourOffset}
                    ORDER BY time ASC
                `, [
                    monitorID,
                    -period,
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
                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successResumed",
                    msgi18n: true,
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
                await server.sendUpdateMonitorIntoList(socket, monitorID);

                callback({
                    ok: true,
                    msg: "successPaused",
                    msgi18n: true,
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

                log.info("manage", `Delete Monitor: ${monitorID} User ID: ${socket.userID}`);

                if (monitorID in server.monitorList) {
                    await server.monitorList[monitorID].stop();
                    delete server.monitorList[monitorID];
                }

                const startTime = Date.now();

                await R.exec("DELETE FROM monitor WHERE id = ? AND user_id = ? ", [
                    monitorID,
                    socket.userID,
                ]);

                // Fix #2880
                apicache.clear();

                const endTime = Date.now();

                log.info("DB", `Delete Monitor completed in : ${endTime - startTime} ms`);

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });
                await server.sendDeleteMonitorFromList(socket, monitorID);

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

                let bean = await R.findOne("tag", " id = ? ", [ tag.id ]);
                if (bean == null) {
                    callback({
                        ok: false,
                        msg: "tagNotFound",
                        msgi18n: true,
                    });
                    return;
                }
                bean.name = tag.name;
                bean.color = tag.color;
                await R.store(bean);

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
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
                    msg: "successDeleted",
                    msgi18n: true,
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
                    msg: "successEdited",
                    msgi18n: true,
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

                callback({
                    ok: true,
                    msg: "successDeleted",
                    msgi18n: true,
                });

            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("monitorImportantHeartbeatListCount", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                let count;
                if (monitorID == null) {
                    count = await R.count("heartbeat", "important = 1");
                } else {
                    count = await R.count("heartbeat", "monitor_id = ? AND important = 1", [
                        monitorID,
                    ]);
                }

                callback({
                    ok: true,
                    count: count,
                });
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                });
            }
        });

        socket.on("monitorImportantHeartbeatListPaged", async (monitorID, offset, count, callback) => {
            try {
                checkLogin(socket);

                let list;
                if (monitorID == null) {
                    list = await R.find("heartbeat", `
                        important = 1
                        ORDER BY time DESC
                        LIMIT ?
                        OFFSET ?
                    `, [
                        count,
                        offset,
                    ]);
                } else {
                    list = await R.find("heartbeat", `
                        monitor_id = ?
                        AND important = 1
                        ORDER BY time DESC
                        LIMIT ?
                        OFFSET ?
                    `, [
                        monitorID,
                        count,
                        offset,
                    ]);
                }

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

        socket.on("changePassword", async (password, callback) => {
            try {
                checkLogin(socket);

                if (!password.newPassword) {
                    throw new Error("Invalid new password");
                }

                if (passwordStrength(password.newPassword).value === "Too weak") {
                    throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
                }

                let user = await doubleCheckPassword(socket, password.currentPassword);
                await user.resetPassword(password.newPassword);

                server.disconnectAllSocketClients(user.id, socket.id);

                callback({
                    ok: true,
                    token: User.createJWT(user, server.jwtSecret),
                    msg: "successAuthChangePassword",
                    msgi18n: true,
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

                // Log out all clients if enabling auth
                // GHSA-23q2-5gf8-gjpp
                if (currentDisabledAuth && !data.disableAuth) {
                    server.disconnectAllSocketClients(socket.userID, socket.id);
                }

                const previousChromeExecutable = await Settings.get("chromeExecutable");
                const previousNSCDStatus = await Settings.get("nscd");

                await setSettings("general", data);
                server.entryPage = data.entryPage;

                // Also need to apply timezone globally
                if (data.serverTimezone) {
                    await server.setTimezone(data.serverTimezone);
                }

                // If Chrome Executable is changed, need to reset the browser
                if (previousChromeExecutable !== data.chromeExecutable) {
                    log.info("settings", "Chrome executable is changed. Resetting Chrome...");
                    await resetChrome();
                }

                // Update nscd status
                if (previousNSCDStatus !== data.nscd) {
                    if (data.nscd) {
                        await server.startNSCDServices();
                    } else {
                        await server.stopNSCDServices();
                    }
                }

                callback({
                    ok: true,
                    msg: "Saved.",
                    msgi18n: true,
                });

                await sendInfo(socket);
                await server.sendMaintenanceList(socket);

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
                    msg: "Saved.",
                    msgi18n: true,
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
                    msg: "successDeleted",
                    msgi18n: true,
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

        socket.on("clearEvents", async (monitorID, callback) => {
            try {
                checkLogin(socket);

                log.info("manage", `Clear Events Monitor: ${monitorID} User ID: ${socket.userID}`);

                await R.exec("UPDATE heartbeat SET msg = ?, important = ? WHERE monitor_id = ? ", [
                    "",
                    "0",
                    monitorID,
                ]);

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

                log.info("manage", `Clear Heartbeats Monitor: ${monitorID} User ID: ${socket.userID}`);

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

                log.info("manage", `Clear Statistics User ID: ${socket.userID}`);

                await R.exec("DELETE FROM heartbeat");
                await R.exec("DELETE FROM stat_daily");
                await R.exec("DELETE FROM stat_hourly");
                await R.exec("DELETE FROM stat_minutely");

                // Restart all monitors to reset the stats
                for (let monitorID in server.monitorList) {
                    await restartMonitor(socket.userID, monitorID);
                }

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
        remoteBrowserSocketHandler(socket);
        generalSocketHandler(socket, server);
        chartSocketHandler(socket);

        log.debug("server", "added all socket handlers");

        // ***************************
        // Better do anything after added all socket handlers here
        // ***************************

        log.debug("auth", "check auto login");
        if (await setting("disableAuth")) {
            log.info("auth", "Disabled Auth: auto login to admin");
            await afterLogin(socket, await R.findOne("user"));
            socket.emit("autoLogin");
        } else {
            socket.emit("loginRequired");
            log.debug("auth", "need auth");
        }

    });

    log.debug("server", "Init the server");

    server.httpServer.once("error", async (err) => {
        log.error("server", "Cannot listen: " + err.message);
        await shutdownFunction();
        process.exit(1);
    });

    await server.start();

    server.httpServer.listen(port, hostname, async () => {
        if (hostname) {
            log.info("server", `Listening on ${hostname}:${port}`);
        } else {
            log.info("server", `Listening on ${port}`);
        }
        await startMonitors();

        // Put this here. Start background jobs after the db and server is ready to prevent clear up during db migration.
        await initBackgroundJobs();

        checkVersion.startInterval();
    });

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

/**
 * Check if a given user owns a specific monitor
 * @param {number} userID ID of user to check
 * @param {number} monitorID ID of monitor to check
 * @returns {Promise<void>}
 * @throws {Error} The specified user does not own the monitor
 */
async function checkOwner(userID, monitorID) {
    let row = await R.getRow("SELECT id FROM monitor WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    if (! row) {
        throw new Error("You do not own this monitor.");
    }
}

/**
 * Function called after user login
 * This function is used to send the heartbeat list of a monitor.
 * @param {Socket} socket Socket.io instance
 * @param {object} user User object
 * @returns {Promise<void>}
 */
async function afterLogin(socket, user) {
    socket.userID = user.id;
    socket.join(user.id);

    let monitorList = await server.sendMonitorList(socket);
    await Promise.allSettled([
        sendInfo(socket),
        server.sendMaintenanceList(socket),
        sendNotificationList(socket),
        sendProxyList(socket),
        sendDockerHostList(socket),
        sendAPIKeyList(socket),
        sendRemoteBrowserList(socket),
        sendMonitorTypeList(socket),
    ]);

    await StatusPage.sendStatusPageList(io, socket);

    const monitorPromises = [];
    for (let monitorID in monitorList) {
        monitorPromises.push(sendHeartbeatList(socket, monitorID));
        monitorPromises.push(Monitor.sendStats(io, monitorID, user.id));
    }

    await Promise.all(monitorPromises);

    // Set server timezone from client browser if not set
    // It should be run once only
    if (! await Settings.get("initServerTimezone")) {
        log.debug("server", "emit initServerTimezone");
        socket.emit("initServerTimezone");
    }
}

/**
 * Initialize the database
 * @param {boolean} testMode Should the connection be
 * started in test mode?
 * @returns {Promise<void>}
 */
async function initDatabase(testMode = false) {
    log.debug("server", "Connecting to the database");
    await Database.connect(testMode);
    log.info("server", "Connected to the database");

    // Patch the database
    await Database.patch(port, hostname);

    let jwtSecretBean = await R.findOne("setting", " `key` = ? ", [
        "jwtSecret",
    ]);

    if (! jwtSecretBean) {
        log.info("server", "JWT secret is not found, generate one.");
        jwtSecretBean = await initJWTSecret();
        log.info("server", "Stored JWT secret into database");
    } else {
        log.debug("server", "Load JWT secret from database.");
    }

    // If there is no record in user table, it is a new Uptime Kuma instance, need to setup
    if ((await R.knex("user").count("id as count").first()).count === 0) {
        log.info("server", "No user, need setup");
        needSetup = true;
    }

    server.jwtSecret = jwtSecretBean.value;
}

/**
 * Start the specified monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function startMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log.info("manage", `Resume Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    let monitor = await R.findOne("monitor", " id = ? ", [
        monitorID,
    ]);

    if (monitor.id in server.monitorList) {
        await server.monitorList[monitor.id].stop();
    }

    server.monitorList[monitor.id] = monitor;
    await monitor.start(io);
}

/**
 * Restart a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID);
}

/**
 * Pause a given monitor
 * @param {number} userID ID of user who owns monitor
 * @param {number} monitorID ID of monitor to start
 * @returns {Promise<void>}
 */
async function pauseMonitor(userID, monitorID) {
    await checkOwner(userID, monitorID);

    log.info("manage", `Pause Monitor: ${monitorID} User ID: ${userID}`);

    await R.exec("UPDATE monitor SET active = 0 WHERE id = ? AND user_id = ? ", [
        monitorID,
        userID,
    ]);

    if (monitorID in server.monitorList) {
        await server.monitorList[monitorID].stop();
        server.monitorList[monitorID].active = 0;
    }
}

/**
 * Resume active monitors
 * @returns {Promise<void>}
 */
async function startMonitors() {
    let list = await R.find("monitor", " active = 1 ");

    for (let monitor of list) {
        server.monitorList[monitor.id] = monitor;
    }

    for (let monitor of list) {
        try {
            await monitor.start(io);
        } catch (e) {
            log.error("monitor", e);
        }
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
    log.info("server", "Shutdown requested");
    log.info("server", "Called signal: " + signal);

    await server.stop();

    log.info("server", "Stopping all monitors");
    for (let id in server.monitorList) {
        let monitor = server.monitorList[id];
        await monitor.stop();
    }
    await sleep(2000);
    await Database.close();

    if (EmbeddedMariaDB.hasInstance()) {
        EmbeddedMariaDB.getInstance().stop();
    }

    stopBackgroundJobs();
    await cloudflaredStop();
    Settings.stopCacheCleaner();
}

/**
 * Final function called before application exits
 * @returns {void}
 */
function finalFunction() {
    log.info("server", "Graceful shutdown successful!");
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
let unexpectedErrorHandler = (error, promise) => {
    console.trace(error);
    UptimeKumaServer.errorLog(error, false);
    console.error("If you keep encountering errors, please report to https://github.com/louislam/uptime-kuma/issues");
};
process.addListener("unhandledRejection", unexpectedErrorHandler);
process.addListener("uncaughtException", unexpectedErrorHandler);
