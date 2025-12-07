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
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../modules/dayjs/plugin/timezone"));
const { UP, MAINTENANCE, DOWN, PENDING, flipStatus, log, badgeConstants } = require("../../src/util");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { makeBadge } = require("badge-maker");
const { Prometheus } = require("../prometheus");
const Database = require("../database");
const { UptimeCalculator } = require("../uptime-calculator");
const jwt = require("jsonwebtoken");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

// CORS for report download (frontend dev uses port 3000)
router.use("/api/monitor/:id/report", (req, res, next) => {
    allowAllOrigin(res);
    res.header("Access-Control-Expose-Headers", "Content-Disposition");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

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

        const userIDs = await require("../util-server").getMonitorUserIDs(monitor.id);
        for (const uid of userIDs) {
            io.to(uid).emit("heartbeat", bean.toJSON());
            Monitor.sendStats(io, monitor.id, uid);
        }

        try {
            new Prometheus(monitor, []).update(bean, undefined);
        } catch (e) {
            log.error("prometheus", "Please submit an issue to our GitHub repo. Prometheus update error: ", e.message);
        }

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
 * Parse timezone offset string like "UTC+8" or "+08:00" into minutes
 * @param {string} tzParam timezone string
 * @returns {number} offset minutes
 */
function parseTZOffset(tzParam) {
    if (!tzParam) {
        return 0;
    }
    const clean = tzParam.toString().trim();
    const simpleMatch = clean.match(/^UTC([+-]?\d{1,2})(?::?(\d{2}))?$/i) || clean.match(/^([+-]?\d{1,2})(?::?(\d{2}))?$/);
    if (simpleMatch) {
        const hours = parseInt(simpleMatch[1]);
        const minutes = simpleMatch[2] ? parseInt(simpleMatch[2]) : 0;
        return hours * 60 + (hours >= 0 ? minutes : -minutes);
    }
    return 0;
}

/**
 * Flatten status for uptime calculation
 * @param {number} status status code
 * @returns {number} flattened status
 */
function flatStatus(status) {
    if (status === DOWN || status === PENDING) {
        return DOWN;
    }
    return UP;
}

/**
 * Compute daily stats and 30-day summary
 * @param {number} monitorID monitor id
 * @param {number} days number of days
 * @param {number} tzOffsetMinutes timezone offset in minutes
 * @returns {Promise<object>} report data
 */
async function computeMonitorReportData(monitorID, days, tzOffsetMinutes) {
    const monitor = await R.findOne("monitor", " id = ? ", [ monitorID ]);
    if (!monitor) {
        throw new Error("Monitor not found");
    }

    const nowTz = dayjs().utcOffset(tzOffsetMinutes);
    const windowStartTz = nowTz.startOf("day").subtract(days - 1, "day");
    const windowStartUTC = windowStartTz.utc();
    const windowEndUTC = nowTz.utc();

    const daily = [];
    for (let i = 0; i < days; i++) {
        const dayStartTz = windowStartTz.add(i, "day");
        daily.push({
            date: dayStartTz.format("YYYY-MM-DD"),
            downtimeCount: 0,
            totalDownSeconds: 0,
            longestDownSeconds: 0,
            totalSeconds: 0,
            pingSum: 0,
            pingCount: 0,
            currentDownRun: 0,
        });
    }

    const prevHeartbeat = await R.getRow("SELECT status, time FROM heartbeat WHERE monitor_id = ? AND time < ? ORDER BY time DESC LIMIT 1", [
        monitorID,
        windowStartUTC.toISOString(),
    ]);

    const heartbeats = await R.getAll("SELECT status, time, ping FROM heartbeat WHERE monitor_id = ? AND time >= ? AND time <= ? ORDER BY time", [
        monitorID,
        windowStartUTC.toISOString(),
        windowEndUTC.toISOString(),
    ]);

    let prevStatus = prevHeartbeat ? flatStatus(Number(prevHeartbeat.status)) : UP;
    let prevTime = windowStartUTC;

    let totalDownSeconds = 0;
    let longestDownSeconds = 0;
    let currentDownRunOverall = 0;
    let downtimeCountOverall = prevStatus === DOWN ? 1 : 0;
    let pingSumOverall = 0;
    let pingCountOverall = 0;

    const events = heartbeats.map((row) => ({
        status: flatStatus(Number(row.status)),
        time: dayjs.utc(row.time),
        ping: row.ping,
    }));

    // Sentinel to close the interval
    events.push({
        status: prevStatus,
        time: windowEndUTC,
        ping: null,
    });

    const baseDayStartTz = windowStartTz.startOf("day");

    function getDayIndex(timestamp) {
        const diffDays = timestamp.utcOffset(tzOffsetMinutes).startOf("day").diff(baseDayStartTz, "day");
        return diffDays >= 0 && diffDays < days ? diffDays : null;
    }

    for (const event of events) {
        // Accumulate duration from prevTime to event.time
        let intervalStart = prevTime;
        const intervalEnd = event.time;

        while (intervalStart.isBefore(intervalEnd)) {
            const dayIndex = getDayIndex(intervalStart);
            if (dayIndex === null) {
                break;
            }

            const dayStart = intervalStart.utcOffset(tzOffsetMinutes).startOf("day").utc();
            const dayEnd = dayStart.add(1, "day");
            const segmentEnd = intervalEnd.isAfter(dayEnd) ? dayEnd : intervalEnd;
            const segSeconds = Math.max(0, segmentEnd.diff(intervalStart, "second"));

            daily[dayIndex].totalSeconds += segSeconds;

            if (prevStatus === DOWN) {
                daily[dayIndex].totalDownSeconds += segSeconds;
                daily[dayIndex].currentDownRun += segSeconds;
                if (daily[dayIndex].currentDownRun > daily[dayIndex].longestDownSeconds) {
                    daily[dayIndex].longestDownSeconds = daily[dayIndex].currentDownRun;
                }
                currentDownRunOverall += segSeconds;
                if (currentDownRunOverall > longestDownSeconds) {
                    longestDownSeconds = currentDownRunOverall;
                }
            } else {
                daily[dayIndex].currentDownRun = 0;
                currentDownRunOverall = 0;
            }

            intervalStart = segmentEnd;
        }

        // Downtime episode counting when entering DOWN
        if (prevStatus !== DOWN && event.status === DOWN) {
            const di = getDayIndex(event.time);
            if (di !== null) {
                daily[di].downtimeCount += 1;
            }
            downtimeCountOverall += 1;
        }

        // Ping samples (store by the event day)
        if (event.ping !== null && event.ping !== undefined) {
            const di = getDayIndex(event.time);
            if (di !== null && event.status === UP) {
                daily[di].pingSum += Number(event.ping);
                daily[di].pingCount += 1;
                pingSumOverall += Number(event.ping);
                pingCountOverall += 1;
            }
        }

        prevStatus = event.status;
        prevTime = event.time;
    }

    // Finalize daily metrics
    const dailyOutput = daily.map((d) => {
        const uptimePercent = d.totalSeconds > 0 ? ((d.totalSeconds - d.totalDownSeconds) / d.totalSeconds) * 100 : null;
        const meanResponseTimeMs = d.pingCount > 0 ? d.pingSum / d.pingCount : null;
        return {
            date: d.date,
            uptimePercent,
            downtimeCount: d.downtimeCount,
            totalDowntimeMinutes: d.totalDownSeconds / 60,
            longestOutageMinutes: d.longestDownSeconds / 60,
            meanResponseTimeMs,
        };
    });

    const summaryTotalSeconds = daily.reduce((acc, d) => acc + d.totalSeconds, 0);
    const summaryDownSeconds = daily.reduce((acc, d) => acc + d.totalDownSeconds, 0);

    const report = {
        monitorID,
        monitorName: monitor.name,
        timeRange: {
            start: windowStartUTC.toISOString(),
            end: windowEndUTC.toISOString(),
            timezone: `UTC${tzOffsetMinutes >= 0 ? "+" : ""}${(tzOffsetMinutes / 60).toFixed(1).replace(/\.0$/, "")}`,
        },
        daily: dailyOutput,
        summary: {
            uptimePercent: summaryTotalSeconds > 0 ? ((summaryTotalSeconds - summaryDownSeconds) / summaryTotalSeconds) * 100 : null,
            downtimeCount: downtimeCountOverall,
            totalDowntimeMinutes: summaryDownSeconds / 60,
            longestOutageMinutes: longestDownSeconds / 60,
            meanResponseTimeMs: pingCountOverall > 0 ? pingSumOverall / pingCountOverall : null,
        },
    };

    return report;
}

/**
 * Generate a CSV report payload
 * @param {object} data Report data
 * @returns {string} CSV string
 */
function buildCSVReport(data) {
    const rows = [
        [ "Monitor", data.monitorName || data.monitorID ],
        [ "Time Range Start", data.timeRange.start ],
        [ "Time Range End", data.timeRange.end ],
        [ "Timezone", data.timeRange.timezone ],
        [ "Uptime (%)", data.summary.uptimePercent != null ? data.summary.uptimePercent.toFixed(2) : "N/A" ],
        [ "Downtime Events", data.summary.downtimeCount ],
        [ "Total Downtime (minutes)", data.summary.totalDowntimeMinutes.toFixed(2) ],
        [ "Longest Outage (minutes)", data.summary.longestOutageMinutes.toFixed(2) ],
        [ "Mean Response Time (ms)", data.summary.meanResponseTimeMs != null ? data.summary.meanResponseTimeMs.toFixed(2) : "N/A" ],
        [],
        [ "Date", "Uptime (%)", "Downtime Events", "Total Downtime (minutes)", "Longest Outage (minutes)", "Mean Response Time (ms)" ],
    ];

    for (const day of data.daily) {
        rows.push([
            day.date,
            day.uptimePercent != null ? day.uptimePercent.toFixed(2) : "N/A",
            day.downtimeCount,
            day.totalDowntimeMinutes.toFixed(2),
            day.longestOutageMinutes.toFixed(2),
            day.meanResponseTimeMs != null ? day.meanResponseTimeMs.toFixed(2) : "N/A",
        ]);
    }

    return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/**
 * Build a minimal PDF buffer containing the report data
 * @param {object} data Report data
 * @returns {Buffer} PDF buffer
 */
function buildPDFReport(data) {
    const lines = [
        "Uptime Kuma Monitor Report (Past 30 Days)",
        `Monitor: ${data.monitorName || data.monitorID}`,
        `Time Range: ${data.timeRange.start} -> ${data.timeRange.end} (${data.timeRange.timezone})`,
        `Uptime (%): ${data.summary.uptimePercent != null ? data.summary.uptimePercent.toFixed(2) : "N/A"}`,
        `Downtime Events: ${data.summary.downtimeCount}`,
        `Total Downtime (minutes): ${data.summary.totalDowntimeMinutes.toFixed(2)}`,
        `Longest Outage (minutes): ${data.summary.longestOutageMinutes.toFixed(2)}`,
        `Mean Response Time (ms): ${data.summary.meanResponseTimeMs != null ? data.summary.meanResponseTimeMs.toFixed(2) : "N/A"}`,
        "",
        "Daily Stats:",
        "Date | Uptime% | Downtime Events | Total Down (m) | Longest Outage (m) | Mean RT (ms)",
    ];

    data.daily.forEach((day) => {
        lines.push(`${day.date} | ${day.uptimePercent != null ? day.uptimePercent.toFixed(2) : "N/A"} | ${day.downtimeCount} | ${day.totalDowntimeMinutes.toFixed(2)} | ${day.longestOutageMinutes.toFixed(2)} | ${day.meanResponseTimeMs != null ? day.meanResponseTimeMs.toFixed(2) : "N/A"}`);
    });

    const escapeText = (text) => String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const pageWidth = 612;
    const pageHeight = 792;

    const contentStream = (() => {
        const cmds = [
            // white background
            "q",
            "1 1 1 rg",
            `0 0 ${pageWidth} ${pageHeight} re`,
            "f",
            "Q",
            "BT",
            "/F1 12 Tf",
            "72 780 Td"
        ];
        lines.forEach((line, index) => {
            if (index > 0) {
                cmds.push("0 -16 Td");
            }
            cmds.push(`(${escapeText(line)}) Tj`);
        });
        cmds.push("ET");
        return cmds.join("\n");
    })();

    const contentLength = Buffer.byteLength(contentStream, "utf8");
    const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
        `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj`,
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [];

    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += obj + "\n";
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
        pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
}

/**
 * Verify JWT from Authorization header (Bearer) and ensure user exists
 * @param {express.Request} request Express request
 * @returns {Promise<object|null>} User bean or null if invalid
 */
async function verifyJWTRequest(request) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
        return null;
    }
    const token = authHeader.slice("bearer ".length);
    try {
        const decoded = jwt.verify(token, server.jwtSecret);
        const user = await R.findOne("user", " username = ? AND active = 1 ", [
            decoded.username,
        ]);
        return user;
    } catch (_) {
        return null;
    }
}

// Authenticated report download for a monitor (past 30 days, timezone-aware)
router.get("/api/monitor/:id/report", async (request, response) => {
    try {
        const monitorID = parseInt(request.params.id, 10);
        if (Number.isNaN(monitorID)) {
            return response.status(400).json({ ok: false, msg: "Invalid monitor id" });
        }

        const format = (request.query.format || "csv").toString().toLowerCase();
        if (!["csv", "pdf"].includes(format)) {
            return response.status(400).json({ ok: false, msg: "Unsupported format" });
        }

        const rangeParam = (request.query.range || "30d").toString();
        const rangeMatch = rangeParam.match(/^(\d+)d$/);
        const days = rangeMatch ? Math.min(parseInt(rangeMatch[1]), 30) : 30;

        const tzOffsetMinutes = parseTZOffset(request.query.tz || "UTC");

        // Auth handling: allow if auth disabled, else require valid JWT bearer
        const authDisabled = await setting("disableAuth");
        if (!authDisabled) {
            const user = await verifyJWTRequest(request);
            if (!user) {
                return response.status(401).json({ ok: false, msg: "Unauthorized" });
            }
        }

        const data = await computeMonitorReportData(monitorID, days, tzOffsetMinutes);
        const filename = `monitor-${monitorID}-report-${days}d.${format}`;

        if (format === "csv") {
            const csv = buildCSVReport(data);
            response.setHeader("Content-Type", "text/csv");
            response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return response.send(csv);
        }

        const pdfBuffer = buildPDFReport(data);
        response.setHeader("Content-Type", "application/pdf");
        response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return response.send(pdfBuffer);
    } catch (error) {
        log.error("api-router", "Failed to generate report", error);
        return response.status(500).json({ ok: false, msg: "Failed to generate report" });
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

module.exports = router;
