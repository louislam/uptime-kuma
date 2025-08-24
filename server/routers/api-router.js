let express = require("express");
const {
    setting,
    allowDevAllOrigin,
    allowAllOrigin,
    percentageToColor,
    filterAndJoin,
    sendHttpError,
} = require("../util-server");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, MAINTENANCE, DOWN, PENDING, flipStatus, log, badgeConstants } = require("../../src/util");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { makeBadge } = require("badge-maker");
const { Prometheus } = require("../prometheus");
const Database = require("../database");
const { UptimeCalculator } = require("../uptime-calculator");
const { apiAuth } = require("../auth");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

router.get("/api/entry-page", async (request, response) => {
    allowDevAllOrigin(response);

    let result = { };
    let hostname = request.hostname;
    if ((await setting("trustProxy")) && request.headers["x-forwarded-host"]) {
        hostname = request.headers["x-forwarded-host"];
    }

    if (hostname in StatusPage.domainMappingList) {
        result.type = "statusPageMatchedDomain";
        result.statusPageSlug = StatusPage.domainMappingList[hostname];
    } else {
        result.type = "entryPage";
        result.entryPage = server.entryPage;
    }
    response.json(result);
});

router.all("/api/push/:pushToken", async (request, response) => {
    try {
        let pushToken = request.params.pushToken;
        let msg = request.query.msg || "OK";
        let ping = parseFloat(request.query.ping) || null;
        let statusString = request.query.status || "up";
        const statusFromParam = (statusString === "up") ? UP : DOWN;

        let monitor = await R.findOne("monitor", " push_token = ? AND active = 1 ", [
            pushToken
        ]);

        if (! monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await Monitor.getPreviousHeartbeat(monitor.id);

        let isFirstBeat = true;

        let bean = R.dispense("heartbeat");
        bean.time = R.isoDateTimeMillis(dayjs.utc());
        bean.monitor_id = monitor.id;
        bean.ping = ping;
        bean.msg = msg;
        bean.downCount = previousHeartbeat?.downCount || 0;

        if (previousHeartbeat) {
            isFirstBeat = false;
            bean.duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

        if (await Monitor.isUnderMaintenance(monitor.id)) {
            msg = "Monitor under maintenance";
            bean.status = MAINTENANCE;
        } else {
            determineStatus(statusFromParam, previousHeartbeat, monitor.maxretries, monitor.isUpsideDown(), bean);
        }

        // Calculate uptime
        let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitor.id);
        let endTimeDayjs = await uptimeCalculator.update(bean.status, parseFloat(bean.ping));
        bean.end_time = R.isoDateTimeMillis(endTimeDayjs);

        log.debug("router", `/api/push/ called at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`);
        log.debug("router", "PreviousStatus: " + previousHeartbeat?.status);
        log.debug("router", "Current Status: " + bean.status);

        bean.important = Monitor.isImportantBeat(isFirstBeat, previousHeartbeat?.status, bean.status);

        if (Monitor.isImportantForNotification(isFirstBeat, previousHeartbeat?.status, bean.status)) {
            // Reset down count
            bean.downCount = 0;

            log.debug("monitor", `[${monitor.name}] sendNotification`);
            await Monitor.sendNotification(isFirstBeat, monitor, bean);
        } else {
            if (bean.status === DOWN && monitor.resendInterval > 0) {
                ++bean.downCount;
                if (bean.downCount >= monitor.resendInterval) {
                    // Send notification again, because we are still DOWN
                    log.debug("monitor", `[${monitor.name}] sendNotification again: Down Count: ${bean.downCount} | Resend Interval: ${monitor.resendInterval}`);
                    await Monitor.sendNotification(isFirstBeat, monitor, bean);

                    // Reset down count
                    bean.downCount = 0;
                }
            }
        }

        await R.store(bean);

        io.to(monitor.user_id).emit("heartbeat", bean.toJSON());

        Monitor.sendStats(io, monitor.id, monitor.user_id);
        new Prometheus(monitor).update(bean, undefined);

        response.json({
            ok: true,
        });
    } catch (e) {
        response.status(404).json({
            ok: false,
            msg: e.message
        });
    }
});

router.get("/api/badge/:id/status", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        upLabel = "Up",
        downLabel = "Down",
        pendingLabel = "Pending",
        maintenanceLabel = "Maintenance",
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        pendingColor = badgeConstants.defaultPendingColor,
        maintenanceColor = badgeConstants.defaultMaintenanceColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        const overrideValue = value !== undefined ? parseInt(value) : undefined;

        let publicMonitor = await R.getRow(`
                SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
                WHERE monitor_group.group_id = \`group\`.id
                AND monitor_group.monitor_id = ?
                AND public = 1
            `,
        [ requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(requestedMonitorId);
            const state = overrideValue !== undefined ? overrideValue : heartbeat.status;

            if (label === undefined) {
                badgeValues.label = "Status";
            } else {
                badgeValues.label = label;
            }
            switch (state) {
                case DOWN:
                    badgeValues.color = downColor;
                    badgeValues.message = downLabel;
                    break;
                case UP:
                    badgeValues.color = upColor;
                    badgeValues.message = upLabel;
                    break;
                case PENDING:
                    badgeValues.color = pendingColor;
                    badgeValues.message = pendingLabel;
                    break;
                case MAINTENANCE:
                    badgeValues.color = maintenanceColor;
                    badgeValues.message = maintenanceLabel;
                    break;
                default:
                    badgeValues.color = badgeConstants.naColor;
                    badgeValues.message = "N/A";
            }
        }

        // build the svg based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/uptime/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultUptimeLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultUptimeValueSuffix,
        color,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);
        // if no duration is given, set value to 24 (h)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        let publicMonitor = await R.getRow(`
                SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
                WHERE monitor_group.group_id = \`group\`.id
                AND monitor_group.monitor_id = ?
                AND public = 1
            `,
        [ requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
            const uptime = overrideValue ?? uptimeCalculator.getDataByDuration(requestedDuration).uptime;

            // limit the displayed uptime percentage to four (two, when displayed as percent) decimal digits
            const cleanUptime = (uptime * 100).toPrecision(4);

            // use a given, custom color or calculate one based on the uptime value
            badgeValues.color = color ?? percentageToColor(uptime);
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Uptime (${requestedDuration.slice(0, -1)}${labelSuffix})`,
            ]);
            badgeValues.message = filterAndJoin([ prefix, cleanUptime, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/ping/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix = badgeConstants.defaultPingLabelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        // Check if monitor is public

        const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
        const publicAvgPing = uptimeCalculator.getDataByDuration(requestedDuration).avgPing;

        const badgeValues = { style };

        if (!publicAvgPing) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPing = parseInt(overrideValue ?? publicAvgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a lable string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([ labelPrefix, label ?? `Avg. Ping (${requestedDuration.slice(0, -1)}${labelSuffix})` ]);
            badgeValues.message = filterAndJoin([ prefix, avgPing, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/avg-response/:duration?", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        const requestedDuration = Math.min(
            request.params.duration
                ? parseInt(request.params.duration, 10)
                : 24,
            720
        );
        const overrideValue = value && parseFloat(value);

        const sqlHourOffset = Database.sqlHourOffset();

        const publicAvgPing = parseInt(await R.getCell(`
            SELECT AVG(ping) FROM monitor_group, \`group\`, heartbeat
            WHERE monitor_group.group_id = \`group\`.id
            AND heartbeat.time > ${sqlHourOffset}
            AND heartbeat.ping IS NOT NULL
            AND public = 1
            AND heartbeat.monitor_id = ?
            `,
        [ -requestedDuration, requestedMonitorId ]
        ));

        const badgeValues = { style };

        if (!publicAvgPing) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPing = parseInt(overrideValue ?? publicAvgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Response (${requestedDuration}h)`,
                labelSuffix,
            ]);
            badgeValues.message = filterAndJoin([ prefix, avgPing, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/cert-exp", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const date = request.query.date;

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = date ? "" : badgeConstants.defaultCertExpValueSuffix,
        upColor = badgeConstants.defaultUpColor,
        warnColor = badgeConstants.defaultWarnColor,
        downColor = badgeConstants.defaultDownColor,
        warnDays = badgeConstants.defaultCertExpireWarnDays,
        downDays = badgeConstants.defaultCertExpireDownDays,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        const overrideValue = value && parseFloat(value);

        let publicMonitor = await R.getRow(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND monitor_group.monitor_id = ?
            AND public = 1
            `,
        [ requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [
                requestedMonitorId,
            ]);

            if (!tlsInfoBean) {
                // return a "No/Bad Cert" badge in naColor (grey), if no cert saved (does not save bad certs?)
                badgeValues.message = "No/Bad Cert";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const tlsInfo = JSON.parse(tlsInfoBean.info_json);

                if (!tlsInfo.valid) {
                    // return a "Bad Cert" badge in naColor (grey), when cert is not valid
                    badgeValues.message = "Bad Cert";
                    badgeValues.color = downColor;
                } else {
                    const daysRemaining = parseInt(overrideValue ?? tlsInfo.certInfo.daysRemaining);

                    if (daysRemaining > warnDays) {
                        badgeValues.color = upColor;
                    } else if (daysRemaining > downDays) {
                        badgeValues.color = warnColor;
                    } else {
                        badgeValues.color = downColor;
                    }
                    // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                    badgeValues.labelColor = labelColor ?? "";
                    // build a label string. If a custom label is given, override the default one
                    badgeValues.label = filterAndJoin([
                        labelPrefix,
                        label ?? "Cert Exp.",
                        labelSuffix,
                    ]);
                    badgeValues.message = filterAndJoin([ prefix, date ? tlsInfo.certInfo.validTo : daysRemaining, suffix ]);
                }
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

router.get("/api/badge/:id/response", cache("5 minutes"), async (request, response) => {
    allowAllOrigin(response);

    const {
        label,
        labelPrefix,
        labelSuffix,
        prefix,
        suffix = badgeConstants.defaultPingValueSuffix,
        color = badgeConstants.defaultPingColor,
        labelColor,
        style = badgeConstants.defaultStyle,
        value, // for demo purpose only
    } = request.query;

    try {
        const requestedMonitorId = parseInt(request.params.id, 10);

        const overrideValue = value && parseFloat(value);

        let publicMonitor = await R.getRow(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND monitor_group.monitor_id = ?
            AND public = 1
            `,
        [ requestedMonitorId ]
        );

        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(
                requestedMonitorId
            );

            if (!heartbeat.ping) {
                // return a "N/A" badge in naColor (grey), if previous heartbeat has no ping

                badgeValues.message = "N/A";
                badgeValues.color = badgeConstants.naColor;
            } else {
                const ping = parseInt(overrideValue ?? heartbeat.ping);

                badgeValues.color = color;
                // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
                badgeValues.labelColor = labelColor ?? "";
                // build a label string. If a custom label is given, override the default one
                badgeValues.label = filterAndJoin([
                    labelPrefix,
                    label ?? "Response",
                    labelSuffix,
                ]);
                badgeValues.message = filterAndJoin([ prefix, ping, suffix ]);
            }
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        sendHttpError(response, error.message);
    }
});

/**
 * Determines the status of the next beat in the push route handling.
 * @param {string} status - The reported new status.
 * @param {object} previousHeartbeat - The previous heartbeat object.
 * @param {number} maxretries - The maximum number of retries allowed.
 * @param {boolean} isUpsideDown - Indicates if the monitor is upside down.
 * @param {object} bean - The new heartbeat object.
 * @returns {void}
 */
function determineStatus(status, previousHeartbeat, maxretries, isUpsideDown, bean) {
    if (isUpsideDown) {
        status = flipStatus(status);
    }

    if (previousHeartbeat) {
        if (previousHeartbeat.status === UP && status === DOWN) {
            // Going Down
            if ((maxretries > 0) && (previousHeartbeat.retries < maxretries)) {
                // Retries available
                bean.retries = previousHeartbeat.retries + 1;
                bean.status = PENDING;
            } else {
                // No more retries
                bean.retries = 0;
                bean.status = DOWN;
            }
        } else if (previousHeartbeat.status === PENDING && status === DOWN && previousHeartbeat.retries < maxretries) {
            // Retries available
            bean.retries = previousHeartbeat.retries + 1;
            bean.status = PENDING;
        } else {
            // No more retries or not pending
            if (status === DOWN) {
                bean.retries = previousHeartbeat.retries + 1;
                bean.status = status;
            } else {
                bean.retries = 0;
                bean.status = status;
            }
        }
    } else {
        // First beat?
        if (status === DOWN && maxretries > 0) {
            // Retries available
            bean.retries = 1;
            bean.status = PENDING;
        } else {
            // Retires not enabled
            bean.retries = 0;
            bean.status = status;
        }
    }
}

// ---------------------------------------------------------------------------
// Maintenance REST API (manual strategy only) under /api/*
// Auth exactly like other API routes: apiAuth validates the header.
// IMPORTANT: apiAuth does NOT set req.userID => we read the API-Key from the
// Basic-Auth-Header and map it to user_id. ONLY API-Key is allowed.
// ---------------------------------------------------------------------------

const { Settings } = require("../settings");

// Constants
const MAINTENANCE_STRATEGY_MANUAL = "manual";
const API_KEY_PREFIX = "uk";
const API_KEY_CACHE_TTL = 60 * 1000; // 1 minute
const HTTP_STATUS = {
    OK: 200,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    INTERNAL_ERROR: 500
};

// Rate limiting for maintenance endpoints - using existing apiRateLimiter pattern
const { apiRateLimiter } = require("../rate-limiter");

// Maintenance-spezifische Rate Limiting Middleware
async function maintenanceRateLimit(req, res, next) {
    try {
        const pass = await apiRateLimiter.pass(null, 0);
        if (pass) {
            apiRateLimiter.removeTokens(1);
            next();
        } else {
            return res.status(429).json({
                ok: false,
                msg: "Too many maintenance API requests",
                code: "RATE_LIMIT_EXCEEDED"
            });
        }
    } catch (e) {
        return res.status(500).json({
            ok: false,
            msg: "Rate limiting error",
            code: "RATE_LIMIT_ERROR"
        });
    }
}

const SQL_MAINT = {
    listManualForUser: `
        SELECT
            id,
            title,
            active,
            strategy,
            description AS msg
        FROM maintenance
        WHERE user_id = ? AND strategy = ?
        ORDER BY id ASC
    `,
    getByIDForUser: `
        SELECT
            id,
            title,
            active,
            strategy,
            description AS msg,
            user_id
        FROM maintenance
        WHERE id = ? AND user_id = ?
        LIMIT 1
    `,
    setActive: `UPDATE maintenance SET active = 1 WHERE id = ?`,
    setInactive: `UPDATE maintenance SET active = 0 WHERE id = ?`,

    // IMPORTANT: `key` is a reserved word → keep backticks
    getAPIKeyRowByID: `
        SELECT id, user_id, \`key\`, active, expires
        FROM api_key
        WHERE id = ?
        LIMIT 1
    `,
};

/** Read Basic-Auth password (= API-Key) from Authorization header */
function readBasicPassword(req) {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Basic ")) return null;
    try {
        const decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
        const idx = decoded.indexOf(":");
        if (idx < 0) return null;
        return decoded.slice(idx + 1);
    } catch {
        return null;
    }
}

/** Split API-Key string into { id, clear } (Format: uk<ID>_<CLEAR>) */
function splitAPIKey(apiKeyStr) {
    if (typeof apiKeyStr !== "string") return null;
    const us = apiKeyStr.indexOf("_");
    if (!apiKeyStr.startsWith(API_KEY_PREFIX) || us < 0) return null;
    const idPart = apiKeyStr.substring(API_KEY_PREFIX.length, us);
    const clear = apiKeyStr.substring(us + 1);
    const id = parseInt(idPart, 10);
    if (!Number.isFinite(id) || !clear) return null;
    return { id, clear };
}

/** Extract User-ID from already authenticated request */
async function extractMaintenanceUserID(req, res, next) {
    try {
        // API Keys must be enabled (already checked by apiAuth)
        const provided = readBasicPassword(req);
        if (!provided) {
            return next(); // apiAuth has already handled this
        }

        const parts = splitAPIKey(provided);
        if (!parts) {
            return next(); // apiAuth has already handled this
        }

        // Get User-ID from DB (key was already validated by apiAuth)
        const row = await R.getRow(SQL_MAINT.getAPIKeyRowByID, [parts.id]);
        if (row) {
            req.maintenanceUserID = row.user_id;
        }

        next();
    } catch (e) {
        // On errors just continue - apiAuth will catch it
        next();
    }
}

/** Maintenance-specific error handling */
function handleMaintenanceError(res, error, defaultMessage = "Internal error") {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            ok: false,
            msg: error.error || defaultMessage,
            code: error.errorCode || "UNKNOWN_ERROR"
        });
    }
    
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
        ok: false,
        msg: error.message || defaultMessage,
        code: "INTERNAL_ERROR"
    });
}

/** Maintenance-specific authorization middleware */
async function authorizeMaintenance(req, res, next) {
    // Check if User-ID was already set by apiAuth
    if (!req.maintenanceUserID) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            ok: false,
            msg: "User ID not found",
            code: "NO_USER_ID"
        });
    }
    next();
}

/** DTO for Maintenance response */
function maintenanceDTO(row) {
    return {
        id: row.id,
        title: row.title,
        strategy: row.strategy,
        active: !!row.active,
        msg: row.msg ?? null,
    };
}

/** Validiert Maintenance-ID Parameter mit erweiterten Checks */
function validateMaintenanceID(idParam) {
    const id = Number(idParam);
    
    // Basic validation
    if (!Number.isFinite(id)) {
        return {
            error: "Invalid maintenance ID - not a number",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_ID_FORMAT"
        };
    }
    
    // Negative IDs
    if (id <= 0) {
        return {
            error: "Invalid maintenance ID - must be positive",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_ID_NEGATIVE"
        };
    }
    
    // Too large IDs (JavaScript Number.MAX_SAFE_INTEGER)
    if (id > Number.MAX_SAFE_INTEGER) {
        return {
            error: "Invalid maintenance ID - too large",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_ID_TOO_LARGE"
        };
    }
    
    // Decimal numbers
    if (!Number.isInteger(id)) {
        return {
            error: "Invalid maintenance ID - must be integer",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_ID_DECIMAL"
        };
    }
    
    // Practical upper limit for database IDs
    if (id > 2147483647) { // MySQL INT max value
        return {
            error: "Invalid maintenance ID - exceeds database limits",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_ID_DATABASE_LIMIT"
        };
    }
    
    return { id };
}

/** Validate and retrieve Maintenance record */
async function getAuthorizedMaintenance(id, userID) {
    const row = await R.getRow(SQL_MAINT.getByIDForUser, [id, userID]);
    if (!row) {
        return {
            error: "Maintenance not found",
            statusCode: HTTP_STATUS.NOT_FOUND,
            errorCode: "MAINTENANCE_NOT_FOUND"
        };
    }
    
    if (row.strategy !== MAINTENANCE_STRATEGY_MANUAL) {
        return {
            error: "Only manual strategy allowed",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "INVALID_STRATEGY"
        };
    }
    
    return { maintenance: row };
}

/** Transactional Update for Maintenance State with Race Condition Protection */
async function updateMaintenanceStateTransactional(id, userID, newActiveState) {
    let transaction;
    try {
        // Start transaction for atomic operation
        transaction = await R.begin();
        
        // 1. Check current state in DB (with row-level lock)
        const currentRow = await R.getRow(`
            SELECT id, active, strategy, user_id 
            FROM maintenance 
            WHERE id = ? AND user_id = ? 
            FOR UPDATE
        `, [id, userID]);
        
        if (!currentRow) {
            await R.rollback();
            return {
                error: "Maintenance not found or access denied",
                statusCode: HTTP_STATUS.NOT_FOUND,
                errorCode: "MAINTENANCE_NOT_FOUND"
            };
        }
        
        // 2. Check if state change is necessary
        if (currentRow.active === newActiveState) {
            await R.rollback();
            return {
                error: `Maintenance already ${newActiveState ? 'active' : 'inactive'}`,
                statusCode: HTTP_STATUS.CONFLICT,
                errorCode: "STATE_ALREADY_SET"
            };
        }
        
        // 3. Update in DB
        const sql = newActiveState ? SQL_MAINT.setActive : SQL_MAINT.setInactive;
        await R.exec(sql, [id]);
        
        // 4. Commit transaction
        await R.commit();
        
        // 5. Update in-memory state (after successful DB update)
        await updateMaintenanceState(id, userID);
        
        return { success: true, maintenance: currentRow };
        
    } catch (error) {
        // Rollback on errors
        if (transaction) {
            await R.rollback();
        }
        throw error;
    }
}

// List (manual maintenance only)
router.get("/api/maintenances", apiAuth, maintenanceRateLimit, extractMaintenanceUserID, authorizeMaintenance, async (req, res) => {
    try {
        const rows = await R.getAll(SQL_MAINT.listManualForUser, [req.maintenanceUserID, MAINTENANCE_STRATEGY_MANUAL]);
        res.json({ ok: true, data: rows.map(maintenanceDTO) });
    } catch (e) {
        handleMaintenanceError(res, e, "Failed to fetch maintenances");
    }
});

// Status
router.get("/api/maintenances/:id/status", apiAuth, maintenanceRateLimit, extractMaintenanceUserID, authorizeMaintenance, async (req, res) => {
    try {
        // Extended request validation
        const requestValidation = validateMaintenanceRequest(req);
        if (requestValidation.error) {
            return handleMaintenanceError(res, requestValidation);
        }
        
        const idValidation = validateMaintenanceID(req.params.id);
        if (idValidation.error) {
            return handleMaintenanceError(res, idValidation);
        }

        const maintenanceResult = await getAuthorizedMaintenance(idValidation.id, req.maintenanceUserID);
        if (maintenanceResult.error) {
            return handleMaintenanceError(res, maintenanceResult);
        }

        res.json({ ok: true, data: maintenanceDTO(maintenanceResult.maintenance) });
    } catch (e) {
        log.error("maintenance", `Failed to get maintenance status ${req.params.id}: ${e.message}`);
        handleMaintenanceError(res, e, "Failed to get maintenance status");
    }
});

/** Aktualisiert In-Memory Maintenance State (non-transactional helper) */
async function updateMaintenanceState(id, userID) {
    const maintenanceObj = server.getMaintenance(id);
    if (maintenanceObj) {
        // Reload from DB to get current state
        const updated = await R.getRow(SQL_MAINT.getByIDForUser, [id, userID]);
        if (updated) {
            maintenanceObj.active = updated.active;
        }
        await server.sendMaintenanceListByUserID(userID);
    } else {
        await server.loadMaintenanceList();
        await server.sendMaintenanceListByUserID(userID);
    }
}

/** Input validation for Maintenance requests */
function validateMaintenanceRequest(req) {
    // Validate URL parameters
    if (!req.params || typeof req.params.id !== 'string') {
        return {
            error: "Missing or invalid maintenance ID in URL",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "MISSING_ID_PARAM"
        };
    }
    
    // ID parameter length check (prevents extremely long strings)
    if (req.params.id.length > 20) {
        return {
            error: "Maintenance ID parameter too long",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "ID_PARAM_TOO_LONG"
        };
    }
    
    // Check for dangerous characters
    if (!/^[0-9]+$/.test(req.params.id)) {
        return {
            error: "Maintenance ID must contain only numbers",
            statusCode: HTTP_STATUS.BAD_REQUEST,
            errorCode: "ID_PARAM_INVALID_CHARS"
        };
    }
    
    return { valid: true };
}

// Start
router.post("/api/maintenances/:id/start", apiAuth, maintenanceRateLimit, extractMaintenanceUserID, authorizeMaintenance, async (req, res) => {
    try {
        // Erweiterte Request-Validierung
        const requestValidation = validateMaintenanceRequest(req);
        if (requestValidation.error) {
            return handleMaintenanceError(res, requestValidation);
        }
        
        const idValidation = validateMaintenanceID(req.params.id);
        if (idValidation.error) {
            return handleMaintenanceError(res, idValidation);
        }

        const maintenanceResult = await getAuthorizedMaintenance(idValidation.id, req.maintenanceUserID);
        if (maintenanceResult.error) {
            return handleMaintenanceError(res, maintenanceResult);
        }

        // Transactional Update with Race Condition Protection
        const updateResult = await updateMaintenanceStateTransactional(
            idValidation.id, 
            req.maintenanceUserID, 
            true // newActiveState = true for start
        );
        
        if (updateResult.error) {
            return handleMaintenanceError(res, updateResult);
        }
        
        // Log for audit trail
        log.info("maintenance", `Started maintenance ${idValidation.id} by user ${req.maintenanceUserID}`);
        
        apicache.clear();
        res.json({ 
            ok: true, 
            msg: "successStarted", 
            data: { ...maintenanceDTO(maintenanceResult.maintenance), active: true } 
        });
    } catch (e) {
        log.error("maintenance", `Failed to start maintenance ${req.params.id}: ${e.message}`);
        handleMaintenanceError(res, e, "Failed to start maintenance");
    }
});

// Stop
router.post("/api/maintenances/:id/stop", apiAuth, maintenanceRateLimit, extractMaintenanceUserID, authorizeMaintenance, async (req, res) => {
    try {
        // Erweiterte Request-Validierung
        const requestValidation = validateMaintenanceRequest(req);
        if (requestValidation.error) {
            return handleMaintenanceError(res, requestValidation);
        }
        
        const idValidation = validateMaintenanceID(req.params.id);
        if (idValidation.error) {
            return handleMaintenanceError(res, idValidation);
        }

        const maintenanceResult = await getAuthorizedMaintenance(idValidation.id, req.maintenanceUserID);
        if (maintenanceResult.error) {
            return handleMaintenanceError(res, maintenanceResult);
        }

        // Transactional Update with Race Condition Protection
        const updateResult = await updateMaintenanceStateTransactional(
            idValidation.id, 
            req.maintenanceUserID, 
            false // newActiveState = false for stop
        );
        
        if (updateResult.error) {
            return handleMaintenanceError(res, updateResult);
        }
        
        // Log for audit trail
        log.info("maintenance", `Stopped maintenance ${idValidation.id} by user ${req.maintenanceUserID}`);
        
        apicache.clear();
        res.json({ 
            ok: true, 
            msg: "successStopped", 
            data: { ...maintenanceDTO(maintenanceResult.maintenance), active: false } 
        });
    } catch (e) {
        log.error("maintenance", `Failed to stop maintenance ${req.params.id}: ${e.message}`);
        handleMaintenanceError(res, e, "Failed to stop maintenance");
    }
});
module.exports = router;
