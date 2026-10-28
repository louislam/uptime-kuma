let express = require("express");
const {
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
const { UptimeKumaServer, getInfo } = require("../uptime-kuma-server");
const { emitHeartbeat } = require("../heartbeat-emit");
const { makeBadge } = require("badge-maker");
const { Prometheus } = require("../prometheus");
const { UptimeCalculator } = require("../uptime-calculator");
const { Settings } = require("../settings");
const { requireApiKey, readApiKey } = require("../auth");
const { getSessionFromHeaders } = require("../better-auth");
const { z } = require("zod");
const { createDocument } = require("zod-openapi");
const { apiReference } = require("@scalar/express-api-reference");
const checkVersion = require("../check-version");

const apiPaths = {};

/**
 * Every route declaring `resolve`, filled below as the routes register and read by the MCP router
 * @type {Array<{method: string, path: string, operation: object}>}
 */
const apiOperations = [];

/**
 * Create the Express handler of a route that only declares `resolve`
 * @param {object} operation OpenAPI operation with a `resolve` function
 * @returns {Function} Express handler answering `{ ok: true, ...body }`
 */
function createRouteHandler(operation) {
    return async (request, response) => {
        try {
            const body = await operation.resolve(request);
            response.json({
                ok: true,
                ...body,
            });
        } catch (e) {
            log.error("api", `Failed to run ${operation.operationId}: ` + e.message);
            response.status(500).json({
                ok: false,
                msg: operation.errorMessage || "Internal server error",
            });
        }
    };
}

/**
 * Create an Express router that also records the OpenAPI operation of each route.
 * The operation is passed as a plain object among the route handlers, e.g.
 * `router.get("/path", middleware, { summary, responses }, handler)`.
 * @returns {express.Router} Router that keeps `router.get(path, ...)` working as usual
 */
function createApiRouter() {
    const apiRouter = express.Router();

    for (const method of ["get", "post", "put", "delete", "patch"]) {
        const register = apiRouter[method].bind(apiRouter);

        apiRouter[method] = (path, ...handlers) => {
            const operation = handlers.find(
                (handler) => typeof handler === "object" && handler !== null && !Array.isArray(handler)
            );
            const middleware = handlers.filter((handler) => handler !== operation);

            if (operation) {
                // `resolve` and `errorMessage` describe the route, they are not part of the OpenAPI document
                const documented = { ...operation };
                delete documented.resolve;
                delete documented.errorMessage;

                apiPaths[path] = {
                    ...(apiPaths[path] || {}),
                    [method]: {
                        security: [{ bearerAuth: [] }],
                        ...documented,
                        responses: {
                            ...errorResponses,
                            ...operation.responses,
                        },
                    },
                };

                if (typeof operation.resolve === "function") {
                    if (!operation.operationId) {
                        throw new Error(`The route ${method.toUpperCase()} ${path} needs an operationId for MCP`);
                    }
                    apiOperations.push({ method, path, operation });
                    middleware.push(createRouteHandler(operation));
                }
            }

            return register(path, ...middleware);
        };
    }

    return apiRouter;
}

let router = express.Router();
let openAPIRouter = createApiRouter();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

/*
 * OpenAPI helpers: the operation is written next to its route, the paths are collected from there
 */
const errorSchema = z
    .object({
        ok: z.literal(false),
        msg: z.string(),
    })
    .meta({ id: "Error" });

const errorResponse = (description) => ({
    description,
    content: {
        "application/json": {
            schema: errorSchema,
        },
    },
});

/**
 * Success response shaped `{ ok: true, ...shape }`, shared by every API route
 * @param {string} description Response description
 * @param {object} shape Additional properties of the body
 * @returns {object} OpenAPI response object
 */
const okResponse = (description, shape) => ({
    description,
    content: {
        "application/json": {
            schema: z.object({
                ok: z.literal(true),
                ...shape,
            }),
        },
    },
});

/**
 * Error responses every API route can return, routes only declare their own add-ons
 */
const errorResponses = {
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("The API is disabled"),
    429: errorResponse("Rate limit exceeded"),
};

const infoSchema = z
    .object({
        primaryBaseURL: z.string().nullable(),
        serverTimezone: z.string(),
        serverTimezoneOffset: z.string(),
        version: z.string(),
        latestVersion: z.string().nullable(),
        isContainer: z.boolean(),
        dbType: z.string(),
        runtime: z.object({
            platform: z.string(),
            arch: z.string(),
        }),
    })
    .meta({ id: "Info" });

const tagSchema = z
    .object({
        tag_id: z.number(),
        monitor_id: z.number(),
        value: z.string().nullable(),
        name: z.string(),
        color: z.string(),
    })
    .meta({ id: "Tag" });

const monitorSchema = z
    .object({
        id: z.number(),
        name: z.string(),
        type: z.string(),
        active: z.boolean(),
        parent: z.number().nullable(),
        childrenIDs: z.array(z.number()),
        tags: z.array(tagSchema),
        path: z.array(z.string()),
        pathName: z.string(),
        interval: z.number(),
        weight: z.number().nullable(),
    })
    .meta({ id: "Monitor" });

/*
 * Server Information
 */
openAPIRouter.get("/api/info", requireApiKey, {
    operationId: "get_info",
    summary: "Get the server information",
    description: "The same payload the dashboard receives from the `info` socket event.",
    errorMessage: "Failed to get the server information",
    resolve: async () => ({
        info: await getInfo(),
    }),
    responses: {
        200: okResponse("Server information", {
            info: infoSchema,
        }),
    },
});

/*
 * Monitors
 */
openAPIRouter.get("/api/monitors", requireApiKey, {
    operationId: "get_monitors",
    summary: "Get all monitors",
    description: "The compact monitor list the dashboard receives after logging in, without secrets.",
    errorMessage: "Failed to get the monitors",
    resolve: async () => ({
        monitors: Object.values(await server.getMonitorJSONList(null, true)),
    }),
    responses: {
        200: okResponse("Monitor list", {
            monitors: z.array(monitorSchema),
        }),
    },
});

let openApiDocument;

/**
 * Build the OpenAPI document once, after every route has registered its operation
 * @returns {object} OpenAPI document
 */
function getOpenApiDocument() {
    if (!openApiDocument) {
        openApiDocument = createDocument({
            openapi: "3.1.0",
            info: {
                title: "Uptime Kuma API",
                version: checkVersion.version,
                description: "Alpha. Requires an API key and the `API and MCP` setting to be enabled.",
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                    },
                },
            },
            paths: apiPaths,
        });
    }

    return openApiDocument;
}

/**
 * Whether the request carries a dashboard session or a valid API key
 * @param {express.Request} request Express request
 * @returns {Promise<boolean>} True when the caller may read the API documentation
 */
async function hasApiAccess(request) {
    // A dashboard session (cookie) can open the docs in a browser
    if (await getSessionFromHeaders(request.headers.cookie)) {
        return true;
    }

    const apiKey = readApiKey(request.headers.authorization);

    return !!(apiKey && (await getSessionFromHeaders(undefined, apiKey)));
}

/**
 * Send a plain text message for the docs page
 * @param {express.Response} response Express response
 * @param {number} status HTTP status
 * @param {string} message Message shown to the user
 * @returns {void}
 */
function sendTextMessage(response, status, message) {
    response.status(status).type("text/plain").send(message);
}

/**
 * Require an enabled API and either an API key or a dashboard session for the JSON document
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 * @param {express.NextFunction} next Next handler in chain
 * @returns {Promise<void>}
 */
async function requireApiAccess(request, response, next) {
    if (!(await Settings.get("apiEnabled"))) {
        response.status(403).json({
            ok: false,
            msg: "The API is disabled",
        });
        return;
    }

    if (await hasApiAccess(request)) {
        next();
        return;
    }

    log.warn("api-auth", "Failed API auth attempt: documentation requires a session or an API key");
    response.status(401).json({
        ok: false,
        msg: "Missing or invalid API key",
    });
}

/**
 * Require the same access for the docs page, but explain it in plain text
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 * @param {express.NextFunction} next Next handler in chain
 * @returns {Promise<void>}
 */
async function requireDocsAccess(request, response, next) {
    if (!(await Settings.get("apiEnabled"))) {
        sendTextMessage(
            response,
            403,
            'The API is disabled. Enable "API and MCP" in Settings -> General to use the API and this documentation.'
        );
        return;
    }

    if (await hasApiAccess(request)) {
        next();
        return;
    }

    sendTextMessage(response, 401, "Log in to Uptime Kuma to view the API documentation.");
}

openAPIRouter.get("/api/openapi.json", requireApiAccess, (request, response) => {
    response.json(getOpenApiDocument());
});

openAPIRouter.get("/api/docs", requireDocsAccess, apiReference({ url: "/api/openapi.json" }));

router.get("/api/entry-page", async (request, response) => {
    allowDevAllOrigin(response);

    let result = {};
    let hostname = request.hostname;
    if ((await Settings.get("trustProxy")) && request.headers["x-forwarded-host"]) {
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
        const statusFromParam = statusString === "up" ? UP : DOWN;

        // Check if status=down was explicitly provided (not defaulting to "up")
        // When explicitly pushing down, bypass retry logic and go directly to DOWN
        const isExplicitDown = request.query.status === "down";

        // Validate ping value - max 100 billion ms (~3.17 years)
        // Fits safely in both BIGINT and FLOAT(20,2)
        const MAX_PING_MS = 100000000000;
        if (ping !== null && (ping < 0 || ping > MAX_PING_MS)) {
            throw new Error(`Invalid ping value. Must be between 0 and ${MAX_PING_MS} ms.`);
        }

        let monitor = await R.findOne("monitor", " push_token = ? AND active = 1 ", [pushToken]);

        if (!monitor) {
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
            determineStatus(
                statusFromParam,
                previousHeartbeat,
                monitor.maxretries,
                monitor.isUpsideDown(),
                bean,
                isExplicitDown
            );
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
                    log.debug(
                        "monitor",
                        `[${monitor.name}] sendNotification again: Down Count: ${bean.downCount} | Resend Interval: ${monitor.resendInterval}`
                    );
                    await Monitor.sendNotification(isFirstBeat, monitor, bean);

                    // Reset down count
                    bean.downCount = 0;
                }
            }
        }

        await R.store(bean);

        emitHeartbeat(io, bean.toJSON());

        Monitor.sendStats(io, monitor.id);

        try {
            new Prometheus(monitor, await monitor.getTags()).update(bean, undefined);
        } catch (e) {
            log.error("prometheus", "Please submit an issue to our GitHub repo. Prometheus update error: ", e.message);
        }

        response.json({
            ok: true,
        });
    } catch (e) {
        response.status(404).json({
            ok: false,
            msg: e.message,
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }
        const overrideValue = value !== undefined ? parseInt(value) : undefined;
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }
        // if no duration is given, set value to 24 (h)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
            await uptimeCalculator.ensureHistoryLoaded();
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
            badgeValues.message = filterAndJoin([prefix, cleanUptime, suffix]);
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        let requestedDuration = request.params.duration !== undefined ? request.params.duration : "24h";
        const overrideValue = value && parseFloat(value);

        if (/^[0-9]+$/.test(requestedDuration)) {
            requestedDuration = `${requestedDuration}h`;
        }

        // Check if monitor is public
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
            await uptimeCalculator.ensureHistoryLoaded();
            const avgPing = uptimeCalculator.getDataByDuration(requestedDuration).avgPing;
            const avgPingValue = parseInt(overrideValue ?? avgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a lable string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Ping (${requestedDuration.slice(0, -1)}${labelSuffix})`,
            ]);
            badgeValues.message = filterAndJoin([prefix, avgPingValue, suffix]);
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        // Default duration is 24 (h) if not defined in queryParam, limited to 720h (30d)
        const requestedDuration = Math.min(request.params.duration ? parseInt(request.params.duration, 10) : 24, 720);
        const overrideValue = value && parseFloat(value);

        const publicMonitor = await isMonitorPublic(requestedMonitorId);

        let avgPing;

        if (publicMonitor) {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(requestedMonitorId);
            await uptimeCalculator.ensureHistoryLoaded();
            avgPing = uptimeCalculator.getDataByDuration(`${requestedDuration}h`).avgPing;
        }

        const badgeValues = { style };

        if (!publicMonitor || !avgPing) {
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const avgPingValue = parseInt(overrideValue ?? avgPing);

            badgeValues.color = color;
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a label string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([
                labelPrefix,
                label ?? `Avg. Response (${requestedDuration}h)`,
                labelSuffix,
            ]);
            badgeValues.message = filterAndJoin([prefix, avgPingValue, suffix]);
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        const overrideValue = value && parseFloat(value);
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [requestedMonitorId]);

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
                    badgeValues.label = filterAndJoin([labelPrefix, label ?? "Cert Exp.", labelSuffix]);
                    badgeValues.message = filterAndJoin([
                        prefix,
                        date ? tlsInfo.certInfo.validTo : daysRemaining,
                        suffix,
                    ]);
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
        if (Number.isNaN(requestedMonitorId)) {
            throw new Error("Invalid monitor ID");
        }

        const overrideValue = value && parseFloat(value);
        const publicMonitor = await isMonitorPublic(requestedMonitorId);
        const badgeValues = { style };

        if (!publicMonitor) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non existent

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const heartbeat = await Monitor.getPreviousHeartbeat(requestedMonitorId);

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
                badgeValues.label = filterAndJoin([labelPrefix, label ?? "Response", labelSuffix]);
                badgeValues.message = filterAndJoin([prefix, ping, suffix]);
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
 * @param {boolean} isExplicitDown - If status=down was explicitly pushed, bypass retries.
 * @returns {void}
 */
function determineStatus(status, previousHeartbeat, maxretries, isUpsideDown, bean, isExplicitDown) {
    if (isUpsideDown) {
        status = flipStatus(status);
    }

    // If status=down was explicitly pushed, bypass retry logic and go directly to DOWN
    if (isExplicitDown && status === DOWN) {
        bean.retries = 0;
        bean.status = DOWN;
        return;
    }

    if (previousHeartbeat) {
        if (previousHeartbeat.status === UP && status === DOWN) {
            // Going Down
            if (maxretries > 0 && previousHeartbeat.retries < maxretries) {
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

/**
 * Check whether a monitor is publc
 * @param {number} monitorID - Monitor id
 * @returns {Promise<boolean>} true if the monitor is public, otherwise false
 */
async function isMonitorPublic(monitorID) {
    let publicMonitor = await R.getRow(
        `
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND monitor_group.monitor_id = ?
            AND public = 1
        `,
        [monitorID]
    );
    return !!publicMonitor;
}

// Existing routes stay on a plain router, the documented API routes live on openAPIRouter
const parentRouter = express.Router();
parentRouter.use(router);
parentRouter.use(openAPIRouter);

// Read by the MCP router, which bridges every `resolve` route to a tool
parentRouter.apiOperations = apiOperations;

module.exports = parentRouter;
