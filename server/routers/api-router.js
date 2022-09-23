let express = require("express");
const { allowDevAllOrigin, allowAllOrigin, percentageToColor, filterAndJoin, send403 } = require("../util-server");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, DOWN, flipStatus, log } = require("../../src/util");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { makeBadge } = require("badge-maker");
const { badgeConstants } = require("../config");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();
let io = server.io;

router.get("/api/entry-page", async (request, response) => {
    allowDevAllOrigin(response);

    let result = { };

    if (request.hostname in StatusPage.domainMappingList) {
        result.type = "statusPageMatchedDomain";
        result.statusPageSlug = StatusPage.domainMappingList[request.hostname];
    } else {
        result.type = "entryPage";
        result.entryPage = server.entryPage;
    }
    response.json(result);
});

router.get("/api/push/:pushToken", async (request, response) => {
    try {

        let pushToken = request.params.pushToken;
        let msg = request.query.msg || "OK";
        let ping = request.query.ping || null;
        let statusString = request.query.status || "up";
        let status = (statusString === "up") ? UP : DOWN;

        let monitor = await R.findOne("monitor", " push_token = ? AND active = 1 ", [
            pushToken
        ]);

        if (! monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await Monitor.getPreviousHeartbeat(monitor.id);

        if (monitor.isUpsideDown()) {
            status = flipStatus(status);
        }

        let isFirstBeat = true;
        let previousStatus = status;
        let duration = 0;

        let bean = R.dispense("heartbeat");
        bean.time = R.isoDateTimeMillis(dayjs.utc());

        if (previousHeartbeat) {
            isFirstBeat = false;
            previousStatus = previousHeartbeat.status;
            duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

        log.debug("router", `/api/push/ called at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`);
        log.debug("router", "PreviousStatus: " + previousStatus);
        log.debug("router", "Current Status: " + status);

        bean.important = Monitor.isImportantBeat(isFirstBeat, previousStatus, status);
        bean.monitor_id = monitor.id;
        bean.status = status;
        bean.msg = msg;
        bean.ping = ping;
        bean.duration = duration;

        await R.store(bean);

        io.to(monitor.user_id).emit("heartbeat", bean.toJSON());
        Monitor.sendStats(io, monitor.id, monitor.user_id);

        response.json({
            ok: true,
        });

        if (bean.important) {
            await Monitor.sendNotification(isFirstBeat, monitor, bean);
        }

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
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
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
            const state = overrideValue !== undefined ? overrideValue : heartbeat.status === 1;

            badgeValues.label = label ? label : "";
            badgeValues.color = state ? upColor : downColor;
            badgeValues.message = label ?? state ? upLabel : downLabel;
        }

        // build the svg based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        send403(response, error.message);
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
        const requestedDuration = request.params.duration !== undefined ? parseInt(request.params.duration, 10) : 24;
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
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant
            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;
        } else {
            const uptime = overrideValue ?? await Monitor.calcUptime(
                requestedDuration,
                requestedMonitorId
            );

            // limit the displayed uptime percentage to four (two, when displayed as percent) decimal digits
            const cleanUptime = parseFloat(uptime.toPrecision(4));

            // use a given, custom color or calculate one based on the uptime value
            badgeValues.color = color ?? percentageToColor(uptime);
            // use a given, custom labelColor or use the default badge label color (defined by badge-maker)
            badgeValues.labelColor = labelColor ?? "";
            // build a lable string. If a custom label is given, override the default one (requestedDuration)
            badgeValues.label = filterAndJoin([ labelPrefix, label ?? requestedDuration, labelSuffix ]);
            badgeValues.message = filterAndJoin([ prefix, `${cleanUptime * 100}`, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        send403(response, error.message);
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
        const requestedDuration = Math.min(request.params.duration ? parseInt(request.params.duration, 10) : 24, 720);
        const overrideValue = value && parseFloat(value);

        const publicAvgPing = parseInt(await R.getCell(`
                SELECT AVG(ping) FROM monitor_group, \`group\`, heartbeat
                WHERE monitor_group.group_id = \`group\`.id
                AND heartbeat.time > DATETIME('now', ? || ' hours')
                AND heartbeat.ping IS NOT NULL
                AND public = 1
                AND heartbeat.monitor_id = ?
            `,
        [ -requestedDuration, requestedMonitorId ]
        ));

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
            badgeValues.label = filterAndJoin([ labelPrefix, label ?? requestedDuration, labelSuffix ]);
            badgeValues.message = filterAndJoin([ prefix, avgPing, suffix ]);
        }

        // build the SVG based on given values
        const svg = makeBadge(badgeValues);

        response.type("image/svg+xml");
        response.send(svg);
    } catch (error) {
        send403(response, error.message);
    }
});

module.exports = router;
