let express = require("express");
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const StatusPage = require("../model/status_page");
const { allowDevAllOrigin, sendHttpError } = require("../util-server");
const { R } = require("redbean-node");
const { badgeConstants, UP, DOWN, MAINTENANCE, PENDING } = require("../../src/util");
const { makeBadge } = require("badge-maker");
const { UptimeCalculator } = require("../uptime-calculator");
const dayjs = require("dayjs");

let router = express.Router();

let cache = apicache.middleware;
const server = UptimeKumaServer.getInstance();

router.get("/status/:slug", cache("5 minutes"), async (request, response) => {
    let slug = request.params.slug;
    slug = slug.toLowerCase();
    await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);
});

router.get("/status/:slug/rss", cache("5 minutes"), async (request, response) => {
    let slug = request.params.slug;
    slug = slug.toLowerCase();
    await StatusPage.handleStatusPageRSSResponse(response, slug);
});

router.get("/status", cache("5 minutes"), async (request, response) => {
    let slug = "default";
    await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);
});

router.get("/status-page", cache("5 minutes"), async (request, response) => {
    let slug = "default";
    await StatusPage.handleStatusPageResponse(response, server.indexHTML, slug);
});

// Status page config, incident, monitor list
router.get("/api/status-page/:slug", cache("5 minutes"), async (request, response) => {
    allowDevAllOrigin(response);
    let slug = request.params.slug;
    slug = slug.toLowerCase();

    try {
        // Get Status Page
        let statusPage = await R.findOne("status_page", " slug = ? ", [
            slug
        ]);

        if (!statusPage) {
            sendHttpError(response, "Status Page Not Found");
            return null;
        }

        let statusPageData = await StatusPage.getStatusPageData(statusPage);

        // Response
        response.json(statusPageData);

    } catch (error) {
        sendHttpError(response, error.message);
    }
});

// Status Page Polling Data
// Can fetch only if published
router.get("/api/status-page/heartbeat/:slug", cache("1 minutes"), async (request, response) => {
    allowDevAllOrigin(response);

    try {
        let heartbeatList = {};
        let uptimeList = {};

        let slug = request.params.slug;
        slug = slug.toLowerCase();
        let statusPageID = await StatusPage.slugToID(slug);

        let monitorIDList = await R.getCol(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `, [
            statusPageID
        ]);

        // Get the status page to determine the heartbeat range
        let statusPage = await R.findOne("status_page", " id = ? ", [ statusPageID ]);
        let heartbeatBarDays = statusPage ? (statusPage.heartbeat_bar_days || 0) : 0;

        for (let monitorID of monitorIDList) {
            const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);

            if (heartbeatBarDays === 0) {
                // Auto mode - use original LIMIT 100 logic
                let list = await R.getAll(`
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ?
                    ORDER BY time DESC
                    LIMIT 100
                `, [
                    monitorID,
                ]);

                list = R.convertToBeans("heartbeat", list);
                heartbeatList[monitorID] = list.reverse().map(row => row.toPublicJSON());
            } else {
                // For configured day ranges, use aggregated data from UptimeCalculator
                heartbeatList[monitorID] = await getAggregatedHeartbeats(uptimeCalculator, heartbeatBarDays);
            }

            uptimeList[`${monitorID}_24`] = uptimeCalculator.get24Hour().uptime;
        }

        response.json({
            heartbeatList,
            uptimeList
        });

    } catch (error) {
        sendHttpError(response, error.message);
    }
});

// Status page's manifest.json
router.get("/api/status-page/:slug/manifest.json", cache("1440 minutes"), async (request, response) => {
    allowDevAllOrigin(response);
    let slug = request.params.slug;
    slug = slug.toLowerCase();

    try {
        // Get Status Page
        let statusPage = await R.findOne("status_page", " slug = ? ", [
            slug
        ]);

        if (!statusPage) {
            sendHttpError(response, "Not Found");
            return;
        }

        // Response
        response.json({
            "name": statusPage.title,
            "start_url": "/status/" + statusPage.slug,
            "display": "standalone",
            "icons": [
                {
                    "src": statusPage.icon,
                    "sizes": "128x128",
                    "type": "image/png"
                }
            ]
        });

    } catch (error) {
        sendHttpError(response, error.message);
    }
});

// overall status-page status badge
router.get("/api/status-page/:slug/badge", cache("5 minutes"), async (request, response) => {
    allowDevAllOrigin(response);
    let slug = request.params.slug;
    slug = slug.toLowerCase();
    const statusPageID = await StatusPage.slugToID(slug);
    const {
        label,
        upColor = badgeConstants.defaultUpColor,
        downColor = badgeConstants.defaultDownColor,
        partialColor = "#F6BE00",
        maintenanceColor = "#808080",
        style = badgeConstants.defaultStyle
    } = request.query;

    try {
        let monitorIDList = await R.getCol(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `, [
            statusPageID
        ]);

        let hasUp = false;
        let hasDown = false;
        let hasMaintenance = false;

        for (let monitorID of monitorIDList) {
            // retrieve the latest heartbeat
            let beat = await R.getAll(`
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ?
                    ORDER BY time DESC
                    LIMIT 1
            `, [
                monitorID,
            ]);

            // to be sure, when corresponding monitor not found
            if (beat.length === 0) {
                continue;
            }
            // handle status of beat
            if (beat[0].status === 3) {
                hasMaintenance = true;
            } else if (beat[0].status === 2) {
                // ignored
            } else if (beat[0].status === 1) {
                hasUp = true;
            } else {
                hasDown = true;
            }

        }

        const badgeValues = { style };

        if (!hasUp && !hasDown && !hasMaintenance) {
            // return a "N/A" badge in naColor (grey), if monitor is not public / not available / non exsitant

            badgeValues.message = "N/A";
            badgeValues.color = badgeConstants.naColor;

        } else {
            if (hasMaintenance) {
                badgeValues.label = label ? label : "";
                badgeValues.color = maintenanceColor;
                badgeValues.message = "Maintenance";
            } else if (hasUp && !hasDown) {
                badgeValues.label = label ? label : "";
                badgeValues.color = upColor;
                badgeValues.message = "Up";
            } else if (hasUp && hasDown) {
                badgeValues.label = label ? label : "";
                badgeValues.color = partialColor;
                badgeValues.message = "Degraded";
            } else {
                badgeValues.label = label ? label : "";
                badgeValues.color = downColor;
                badgeValues.message = "Down";
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

/**
 * Get aggregated heartbeats for status page display
 * @param {UptimeCalculator} uptimeCalculator The uptime calculator instance
 * @param {number} days Number of days to show
 * @returns {Promise<Array>} Array of aggregated heartbeat data
 */
async function getAggregatedHeartbeats(uptimeCalculator, days) {
    const now = dayjs.utc();
    const result = [];

    // Calculate the actual time range we have
    const startTime = now.subtract(days, "day").startOf("minute");
    const endTime = now;
    const totalMinutes = endTime.diff(startTime, "minute");

    // Calculate how many buckets we can actually show (max 100)
    const targetBuckets = Math.min(100, totalMinutes);
    const bucketSizeMinutes = Math.max(1, Math.floor(totalMinutes / targetBuckets));

    // Determine data granularity based on days
    let dataPoints;
    let granularity;

    if (days <= 1) {
        // For 1 day or less, use minutely data
        granularity = "minute";
        dataPoints = uptimeCalculator.getDataArray(days * 24 * 60, granularity);
    } else if (days <= 30) {
        // For 2-30 days, use hourly data
        granularity = "hour";
        dataPoints = uptimeCalculator.getDataArray(days * 24, granularity);
    } else {
        // For 31+ days, use daily data
        granularity = "day";
        dataPoints = uptimeCalculator.getDataArray(days, granularity);
    }

    // Create time buckets
    const buckets = [];
    const actualBuckets = Math.floor(totalMinutes / bucketSizeMinutes);

    for (let i = 0; i < actualBuckets; i++) {
        const bucketStart = startTime.add(i * bucketSizeMinutes, "minute");
        const bucketEnd = bucketStart.add(bucketSizeMinutes, "minute");

        buckets.push({
            start: bucketStart.unix(),
            end: bucketEnd.unix(),
            up: 0,
            down: 0,
            maintenance: 0,
            pending: 0,
            hasData: false
        });
    }

    // Aggregate data points into buckets
    for (const dataPoint of dataPoints) {
        if (!dataPoint || !dataPoint.timestamp) {
            continue;
        }

        // Find the appropriate bucket for this data point
        const bucket = buckets.find(b =>
            dataPoint.timestamp >= b.start && dataPoint.timestamp < b.end
        );

        if (bucket) {
            bucket.up += dataPoint.up || 0;
            bucket.down += dataPoint.down || 0;
            bucket.maintenance += dataPoint.maintenance || 0;
            bucket.pending += dataPoint.pending || 0;
            bucket.hasData = true;
        }
    }

    // Convert buckets to heartbeat format
    for (const bucket of buckets) {
        let status = null; // No data

        if (bucket.hasData) {
            // Determine status based on priority: DOWN > MAINTENANCE > PENDING > UP
            if (bucket.down > 0) {
                status = DOWN;
            } else if (bucket.maintenance > 0) {
                status = MAINTENANCE;
            } else if (bucket.pending > 0) {
                status = PENDING;
            } else if (bucket.up > 0) {
                status = UP;
            }
        }

        result.push({
            status: status,
            time: dayjs.unix(bucket.end).toISOString(),
            msg: "",
            ping: null,
            // Include aggregation info for client-side display
            _aggregated: true,
            _startTime: dayjs.unix(bucket.start).toISOString(),
            _endTime: dayjs.unix(bucket.end).toISOString(),
            _counts: {
                up: bucket.up,
                down: bucket.down,
                maintenance: bucket.maintenance,
                pending: bucket.pending
            }
        });
    }

    return result;
}

module.exports = router;
