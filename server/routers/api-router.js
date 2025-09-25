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

router.post("/api/monitors/import", apiAuth, async (request, response) => {
    try {
        const { monitors, options = {} } = request.body;

        if (!monitors || !Array.isArray(monitors)) {
            return response.status(400).json({
                ok: false,
                msg: "Field 'monitors' is required and must be an array"
            });
        }

        let userId = null;

        const users = await R.findAll("user", "ORDER BY id ASC");
        if (users && users.length > 0) {
            userId = users[0].id;
            log.info("import", `Using user ID ${userId} for imported monitors`);
        }

        if (!userId) {
            return response.status(500).json({
                ok: false,
                msg: "No user found in the system"
            });
        }

        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        for (const monitorData of monitors) {
            try {
                if (monitorData.type === 'group') {
                    log.warn("import", `Monitor ${monitorData.name}: Converting 'group' type to 'http' type`);
                    monitorData.type = 'http';
                    monitorData.url = monitorData.url || 'https://example.com';
                    monitorData.active = false; // Disable group monitors by default
                }

                const validation = validateMonitorData(monitorData);
                if (!validation.isValid) {
                    results.errors.push(`Monitor ${monitorData.name || 'unnamed'}: ${validation.errors.join(', ')}`);
                    continue;
                }

                const existing = await R.findOne("monitor", "name = ? AND user_id = ?", [
                    monitorData.name,
                    userId
                ]);

                if (existing) {
                    if (options.skipExisting !== false) {
                        results.skipped++;
                        continue;
                    } else if (options.overwriteExisting === true) {
                        await updateMonitorFromData(existing, monitorData, userId);
                        results.imported++;
                        continue;
                    } else {
                        results.skipped++;
                        continue;
                    }
                }

                await createMonitorFromData(monitorData, userId);
                results.imported++;

            } catch (error) {
                results.errors.push(`Monitor ${monitorData.name || 'unnamed'}: ${error.message}`);
            }
        }

        response.json({
            ok: true,
            results: results
        });

    } catch (error) {
        log.error("api", `Error importing monitors: ${error.message}`);
        response.status(500).json({
            ok: false,
            msg: error.message
        });
    }
});

async function createMonitorFromData(monitorData, userId) {
    let bean = R.dispense("monitor");

    await mapMonitorFields(bean, monitorData, userId);

    await R.store(bean);

    if (monitorData.tags && Array.isArray(monitorData.tags)) {
        await processTags(bean.id, monitorData.tags);
    }

    if (monitorData.notificationIDList) {
        await processNotifications(bean.id, monitorData.notificationIDList, userId);
    }

    if (monitorData.statusPageSlug && monitorData.groupName) {
        await processStatusPageGroup(bean.id, monitorData.statusPageSlug, monitorData.groupName);
    }
}

async function updateMonitorFromData(existingBean, monitorData, userId) {
    await mapMonitorFields(existingBean, monitorData, userId);

    await R.store(existingBean);

    await R.exec("DELETE FROM monitor_tag WHERE monitor_id = ?", [existingBean.id]);
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ?", [existingBean.id]);

    if (monitorData.tags && Array.isArray(monitorData.tags)) {
        await processTags(existingBean.id, monitorData.tags);
    }

    if (monitorData.notificationIDList) {
        await processNotifications(existingBean.id, monitorData.notificationIDList, userId);
    }

    if (monitorData.statusPageSlug && monitorData.groupName) {
        await processStatusPageGroup(existingBean.id, monitorData.statusPageSlug, monitorData.groupName);
    }
}

async function mapMonitorFields(bean, monitorData, userId) {
    bean.name = monitorData.name;
    bean.type = monitorData.type;
    bean.user_id = userId;

    bean.description = monitorData.description || null;
    bean.url = monitorData.url || "";
    bean.method = monitorData.method || "GET";
    bean.hostname = monitorData.hostname || null;
    bean.port = monitorData.port || null;
    bean.timeout = monitorData.timeout || 48;
    bean.interval = monitorData.interval || 60;
    bean.retry_interval = monitorData.retryInterval || 60;
    bean.resend_interval = monitorData.resendInterval || 0;
    bean.maxretries = monitorData.maxretries || 2;
    bean.weight = monitorData.weight || 2000;
    bean.active = monitorData.active !== false;
    bean.parent = monitorData.parent || null;

    bean.keyword = monitorData.keyword || null;
    bean.invert_keyword = monitorData.invertKeyword || false;
    bean.expiry_notification = monitorData.expiryNotification || false;
    bean.ignore_tls = monitorData.ignoreTls || false;
    bean.upside_down = monitorData.upsideDown || false;
    bean.packet_size = monitorData.packetSize || 56;
    bean.maxredirects = monitorData.maxredirects || 10;

    if (monitorData.accepted_statuscodes && Array.isArray(monitorData.accepted_statuscodes)) {
        bean.accepted_statuscodes_json = JSON.stringify(monitorData.accepted_statuscodes);
    } else {
        bean.accepted_statuscodes_json = '["200-299"]';
    }

    bean.dns_resolve_type = monitorData.dns_resolve_type || "A";
    bean.dns_resolve_server = monitorData.dns_resolve_server || "1.1.1.1";
    bean.dns_last_result = monitorData.dns_last_result || null;

    bean.docker_container = monitorData.docker_container || "";
    bean.docker_host = monitorData.docker_host || null;

    bean.proxy_id = monitorData.proxyId || null;

    bean.mqtt_topic = monitorData.mqttTopic || "";
    bean.mqtt_success_message = monitorData.mqttSuccessMessage || "";
    bean.mqtt_check_type = monitorData.mqttCheckType || "keyword";
    bean.mqtt_username = monitorData.mqttUsername || "";
    bean.mqtt_password = monitorData.mqttPassword || "";

    bean.database_query = monitorData.databaseQuery || null;
    bean.database_connection_string = monitorData.databaseConnectionString || null;

    bean.auth_method = monitorData.authMethod || null;
    bean.basic_auth_user = monitorData.basic_auth_user || null;
    bean.basic_auth_pass = monitorData.basic_auth_pass || null;
    bean.auth_workstation = monitorData.authWorkstation || null;
    bean.auth_domain = monitorData.authDomain || null;

    bean.oauth_client_id = monitorData.oauth_client_id || null;
    bean.oauth_client_secret = monitorData.oauth_client_secret || null;
    bean.oauth_token_url = monitorData.oauth_token_url || null;
    bean.oauth_scopes = monitorData.oauth_scopes || null;
    bean.oauth_auth_method = monitorData.oauth_auth_method || "client_secret_basic";

    bean.grpc_url = monitorData.grpcUrl || null;
    bean.grpc_protobuf = monitorData.grpcProtobuf || null;
    bean.grpc_method = monitorData.grpcMethod || null;
    bean.grpc_service_name = monitorData.grpcServiceName || null;
    bean.grpc_enable_tls = monitorData.grpcEnableTls || false;
    bean.grpc_body = monitorData.grpcBody || null;
    bean.grpc_metadata = monitorData.grpcMetadata || null;

    bean.radius_called_station_id = monitorData.radiusCalledStationId || null;
    bean.radius_calling_station_id = monitorData.radiusCallingStationId || null;
    bean.radius_username = monitorData.radiusUsername || null;
    bean.radius_password = monitorData.radiusPassword || null;
    bean.radius_secret = monitorData.radiusSecret || null;

    bean.game = monitorData.game || null;
    bean.gamedig_given_port_only = monitorData.gamedigGivenPortOnly || true;

    bean.http_body_encoding = monitorData.httpBodyEncoding || "json";
    bean.json_path = monitorData.jsonPath || null;
    bean.expected_value = monitorData.expectedValue || null;
    bean.headers = monitorData.headers || null;
    bean.body = monitorData.body || null;

    bean.kafka_producer_topic = monitorData.kafkaProducerTopic || null;
    if (monitorData.kafkaProducerBrokers && Array.isArray(monitorData.kafkaProducerBrokers)) {
        bean.kafka_producer_brokers = JSON.stringify(monitorData.kafkaProducerBrokers);
    }
    bean.kafka_producer_ssl = monitorData.kafkaProducerSsl || false;
    bean.kafka_producer_allow_auto_topic_creation = monitorData.kafkaProducerAllowAutoTopicCreation || false;
    bean.kafka_producer_message = monitorData.kafkaProducerMessage || null;
    if (monitorData.kafkaProducerSaslOptions && typeof monitorData.kafkaProducerSaslOptions === 'object') {
        bean.kafka_producer_sasl_options = JSON.stringify(monitorData.kafkaProducerSaslOptions);
    }

    bean.tls_ca = monitorData.tlsCa || null;
    bean.tls_cert = monitorData.tlsCert || null;
    bean.tls_key = monitorData.tlsKey || null;

    bean.push_token = monitorData.pushToken || null;
}

async function processTags(monitorId, tags) {
    for (const tagData of tags) {
        try {
            let tag = await R.findOne("tag", "name = ? AND color = ?", [
                tagData.name,
                tagData.color
            ]);

            if (!tag) {
                tag = R.dispense("tag");
                tag.name = tagData.name;
                tag.color = tagData.color;
                await R.store(tag);
            }

            const monitorTag = R.dispense("monitor_tag");
            monitorTag.monitor_id = monitorId;
            monitorTag.tag_id = tag.id;
            monitorTag.value = tagData.value || "";

            await R.store(monitorTag);

        } catch (error) {
            log.error("api", `Error processing tag ${tagData.name}: ${error.message}`);
        }
    }
}

async function processNotifications(monitorId, notificationList, userId) {
    if (Array.isArray(notificationList)) {
        log.info("api", `Processing notifications by names for monitor ${monitorId}: [${notificationList.map(n => `"${n}"`).join(", ")}]`);

        for (const notificationName of notificationList) {
            try {
                if (typeof notificationName === 'string' && notificationName.trim()) {
                    // Find notification by name
                    const notification = await R.findOne("notification", "name = ? AND user_id = ?", [
                        notificationName.trim(),
                        userId
                    ]);

                    if (notification) {
                        // Create monitor_notification relationship
                        const monitorNotification = R.dispense("monitor_notification");
                        monitorNotification.monitor_id = monitorId;
                        monitorNotification.notification_id = notification.id;

                        await R.store(monitorNotification);
                        log.info("api", `? Associated notification "${notificationName}" (ID: ${notification.id}) with monitor ${monitorId}`);
                    } else {
                        log.warn("api", `? Notification with name "${notificationName}" not found for user ${userId}`);
                    }
                }
            } catch (error) {
                log.error("api", `Error processing notification "${notificationName}": ${error.message}`);
            }
        }
    } else if (notificationList && typeof notificationList === 'object') {
        log.info("api", `Processing notifications by IDs for monitor ${monitorId} (legacy format)`);

        for (const [notificationId, enabled] of Object.entries(notificationList)) {
            try {
                if (enabled === true) {
                    // Check if notification exists and belongs to the user
                    const notification = await R.findOne("notification", "id = ? AND user_id = ?", [
                        parseInt(notificationId),
                        userId
                    ]);

                    if (notification) {
                        // Create monitor_notification relationship
                        const monitorNotification = R.dispense("monitor_notification");
                        monitorNotification.monitor_id = monitorId;
                        monitorNotification.notification_id = notification.id;

                        await R.store(monitorNotification);
                        log.info("api", `? Associated notification ID ${notificationId} with monitor ${monitorId}`);
                    } else {
                        log.warn("api", `? Notification ID ${notificationId} not found or doesn't belong to user ${userId}`);
                    }
                }
            } catch (error) {
                log.error("api", `Error processing notification ${notificationId}: ${error.message}`);
            }
        }
    } else {
        log.warn("api", `Invalid notification list format for monitor ${monitorId}. Expected array of names or object with ID:boolean pairs.`);
    }
}

function validateMonitorData(monitorData) {
    const errors = [];

    if (!monitorData.name || typeof monitorData.name !== 'string' || monitorData.name.trim() === '') {
        errors.push("Monitor name is required");
    }

    if (!monitorData.type || typeof monitorData.type !== 'string') {
        errors.push("Monitor type is required");
    }

    const validTypes = [
        "http", "https", "ping", "port", "dns", "push", "steam", "docker",
        "mqtt", "sqlserver", "postgres", "mysql", "mongodb", "radius",
        "redis", "grpc", "kafka-producer", "gamedig", "json-query"
    ];

    if (monitorData.type && !validTypes.includes(monitorData.type)) {
        errors.push(`Monitor type '${monitorData.type}' is not valid`);
    }

    if (monitorData.type === "http" || monitorData.type === "https") {
        if (monitorData.url && typeof monitorData.url === 'string') {
            try {
                new URL(monitorData.url);
            } catch {
                errors.push("URL must be valid");
            }
        }
    }

    if (monitorData.type === "ping" || monitorData.type === "dns") {
        if (!monitorData.hostname || typeof monitorData.hostname !== 'string') {
            errors.push("Hostname is required for Ping/DNS monitors");
        }
    }

    if (monitorData.type === "port") {
        if (!monitorData.hostname || typeof monitorData.hostname !== 'string') {
            errors.push("Hostname is required for port monitors");
        }
        if (!monitorData.port || typeof monitorData.port !== 'number' || monitorData.port < 1 || monitorData.port > 65535) {
            errors.push("Port must be a valid number between 1 and 65535");
        }
    }

    if (monitorData.interval !== undefined) {
        const interval = Number(monitorData.interval);
        if (isNaN(interval) || interval < 20 || interval > 86400) {
            errors.push("Interval must be a number between 20 and 86400 seconds");
        }
    }

    if (monitorData.timeout !== undefined) {
        const timeout = Number(monitorData.timeout);
        if (isNaN(timeout) || timeout < 1 || timeout > 300) {
            errors.push("Timeout must be a number between 1 and 300 seconds");
        }
    }

    if (monitorData.maxretries !== undefined) {
        const maxretries = Number(monitorData.maxretries);
        if (isNaN(maxretries) || maxretries < 0 || maxretries > 10) {
            errors.push("Max retries must be a number between 0 and 10");
        }
    }

    if (monitorData.weight !== undefined) {
        const weight = Number(monitorData.weight);
        if (isNaN(weight) || weight < 0) {
            errors.push("Weight must be a positive number");
        }
    }

    if (monitorData.accepted_statuscodes && !Array.isArray(monitorData.accepted_statuscodes)) {
        errors.push("Accepted status codes must be an array");
    }

    if (monitorData.kafkaProducerBrokers && !Array.isArray(monitorData.kafkaProducerBrokers)) {
        errors.push("Kafka brokers must be an array");
    }

    if (monitorData.tags && !Array.isArray(monitorData.tags)) {
        errors.push("Tags must be an array");
    } else if (monitorData.tags) {
        for (let i = 0; i < monitorData.tags.length; i++) {
            const tag = monitorData.tags[i];
            if (!tag.name || typeof tag.name !== 'string') {
                errors.push(`Tag ${i + 1}: name is required`);
            }
            if (!tag.color || typeof tag.color !== 'string') {
                errors.push(`Tag ${i + 1}: color is required`);
            }
        }
    }

    if (monitorData.notificationIDList && typeof monitorData.notificationIDList !== 'object') {
        errors.push("Notification list must be an object");
    }

    if (monitorData.statusPageSlug && typeof monitorData.statusPageSlug !== 'string') {
        errors.push("Status page slug must be a string");
    }

    if (monitorData.groupName && typeof monitorData.groupName !== 'string') {
        errors.push("Group name must be a string");
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    }
}

async function processStatusPageGroup(monitorId, statusPageSlug, groupName) {
    try {
        // Find status page by slug
        const statusPage = await R.findOne("status_page", "slug = ?", [statusPageSlug]);

        if (!statusPage) {
            log.warn("api", `Status page with slug '${statusPageSlug}' not found`);
            return;
        }

        // Check if group exists for this status page
        let group = await R.findOne("group", "name = ? AND status_page_id = ?", [
            groupName,
            statusPage.id
        ]);

        // Create group if it doesn't exist
        if (!group) {
            group = R.dispense("group");
            group.name = groupName;
            group.status_page_id = statusPage.id;
            group.public = true;  // Make group public by default
            group.active = true;
            group.weight = 1000;  // Default weight

            await R.store(group);
            log.info("api", `Created new group '${groupName}' (id: ${group.id}) for status page '${statusPageSlug}'`);
        } else {
            log.info("api", `Using existing group '${groupName}' (id: ${group.id}) for status page '${statusPageSlug}'`);
        }

        // Check if monitor is already in this group
        const existingRelation = await R.findOne("monitor_group", "monitor_id = ? AND group_id = ?", [
            monitorId,
            group.id
        ]);

        log.debug("api", `Checking relationship: monitor_id=${monitorId}, group_id=${group.id}, existing=${!!existingRelation}`);

        if (!existingRelation) {
            // Create monitor-group relationship
            const monitorGroup = R.dispense("monitor_group");
            monitorGroup.monitor_id = monitorId;
            monitorGroup.group_id = group.id;
            monitorGroup.weight = 1000;  // Default weight
            monitorGroup.send_url = false;

            await R.store(monitorGroup);
            log.info("api", `Added monitor ${monitorId} to group '${groupName}' (group_id: ${group.id}) in status page '${statusPageSlug}'`);
        } else {
            log.warn("api", `Monitor ${monitorId} already exists in group '${groupName}' (group_id: ${group.id}) - existing relation id: ${existingRelation.id}`);
        }

    } catch (error) {
        log.error("api", `Error processing status page group: ${error.message}`);
    };
}

module.exports = router;
