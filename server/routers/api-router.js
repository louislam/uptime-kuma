let express = require("express");
const { allowDevAllOrigin, getSettings, setting } = require("../util-server");
const { R } = require("redbean-node");
const server = require("../server");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, flipStatus, debug } = require("../../src/util");
let router = express.Router();

let cache = apicache.middleware;
let io = server.io;

router.get("/api/entry-page", async (_, response) => {
    allowDevAllOrigin(response);
    response.json(server.entryPage);
});

router.get("/api/push/:pushToken", async (request, response) => {
    const trx = await R.begin();
    try {
        let pushToken = request.params.pushToken;

        let {msg, ping, ...requestTags} = request.query;
        msg = msg || "OK";
        ping = ping || null;

        let monitor = await trx.findOne("monitor", " push_token = ? AND active = 1 ", [
            pushToken
        ]);

        if (! monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await trx.getRow(`
            SELECT status, time FROM heartbeat
            WHERE id = (select MAX(id) from heartbeat where monitor_id = ?)
        `, [
            monitor.id
        ]);

        const tagKeys = Object.keys(requestTags)
        if (tagKeys.length > 0) {
            // Request has additional tags. Fetch all tags for this monitor.
            const dbTags = await trx.getAll("SELECT tag.id, tag.name FROM tag JOIN monitor_tag ON monitor_tag.tag_id = tag.id AND monitor_tag.monitor_id = ?", [monitor.id]);

            // Update monitor_tag, ignoring non-existing request tags.
            dbTags
                .filter(tag => tagKeys.includes(tag.name))
                .forEach(async tag => {
                    const tagValue = requestTags[tag.name];

                    await trx.exec("UPDATE monitor_tag SET value = ? WHERE tag_id = ? AND monitor_id = ?", [
                        tagValue,
                        tag.id,
                        monitor.id,
                    ]);

                    // FixMe: Not working. What to emit here?
                    io.to(monitor.user_id).emit("addMonitorTag", tag.id, monitor.id, tagValue);
                });
        }

        // FixMe: Bean returned by trx.dispense() has no .toJSON() method (!?).
        let status = UP;
        if (monitor.isUpsideDown()) {
            status = flipStatus(status);
        }

        let isFirstBeat = true;
        let previousStatus = status;
        let duration = 0;

        let bean = R.dispense("heartbeat");         // Should be trx.dispense();
        bean.time = R.isoDateTime(dayjs.utc());

        if (previousHeartbeat) {
            isFirstBeat = false;
            previousStatus = previousHeartbeat.status;
            duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

        debug("PreviousStatus: " + previousStatus);
        debug("Current Status: " + status);

        bean.important = Monitor.isImportantBeat(isFirstBeat, previousStatus, status);
        bean.monitor_id = monitor.id;
        bean.status = status;
        bean.msg = msg;
        bean.ping = ping;
        bean.duration = duration;

        await trx.store(bean);

        io.to(monitor.user_id).emit("heartbeat", bean.toJSON());
        Monitor.sendStats(io, monitor.id, monitor.user_id);

        await trx.commit();

        response.json({
            ok: true,
        });

        if (bean.important) {
            await Monitor.sendNotification(isFirstBeat, monitor, bean);
        }

    } catch (e) {
        await trx.rollback();

        response.json({
            ok: false,
            msg: e.message
        });
    }
});

// Status Page Config
router.get("/api/status-page/config", async (_request, response) => {
    allowDevAllOrigin(response);

    let config = await getSettings("statusPage");

    if (! config.statusPageTheme) {
        config.statusPageTheme = "light";
    }

    if (! config.statusPagePublished) {
        config.statusPagePublished = true;
    }

    if (! config.title) {
        config.title = "Uptime Kuma";
    }

    response.json(config);
});

// Status Page - Get the current Incident
// Can fetch only if published
router.get("/api/status-page/incident", async (_, response) => {
    allowDevAllOrigin(response);

    try {
        await checkPublished();

        let incident = await R.findOne("incident", " pin = 1 AND active = 1");

        if (incident) {
            incident = incident.toPublicJSON();
        }

        response.json({
            ok: true,
            incident,
        });

    } catch (error) {
        send403(response, error.message);
    }
});

// Status Page - Monitor List
// Can fetch only if published
router.get("/api/status-page/monitor-list", cache("5 minutes"), async (_request, response) => {
    allowDevAllOrigin(response);

    try {
        await checkPublished();
        const publicGroupList = [];
        let list = await R.find("group", " public = 1 ORDER BY weight ");

        for (let groupBean of list) {
            publicGroupList.push(await groupBean.toPublicJSON());
        }

        response.json(publicGroupList);

    } catch (error) {
        send403(response, error.message);
    }
});

// Status Page Polling Data
// Can fetch only if published
router.get("/api/status-page/heartbeat", cache("5 minutes"), async (_request, response) => {
    allowDevAllOrigin(response);

    try {
        await checkPublished();

        let heartbeatList = {};
        let uptimeList = {};

        let monitorIDList = await R.getCol(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
        `);

        for (let monitorID of monitorIDList) {
            let list = await R.getAll(`
                    SELECT * FROM heartbeat
                    WHERE monitor_id = ?
                    ORDER BY time DESC
                    LIMIT 50
            `, [
                monitorID,
            ]);

            list = R.convertToBeans("heartbeat", list);
            heartbeatList[monitorID] = list.reverse().map(row => row.toPublicJSON());

            const type = 24;
            uptimeList[`${monitorID}_${type}`] = await Monitor.calcUptime(type, monitorID);
        }

        response.json({
            heartbeatList,
            uptimeList
        });

    } catch (error) {
        send403(response, error.message);
    }
});

async function checkPublished() {
    if (! await isPublished()) {
        throw new Error("The status page is not published");
    }
}

/**
 * Default is published
 * @returns {Promise<boolean>}
 */
async function isPublished() {
    const value = await setting("statusPagePublished");
    if (value === null) {
        return true;
    }
    return value;
}

function send403(res, msg = "") {
    res.status(403).json({
        "status": "fail",
        "msg": msg,
    });
}

module.exports = router;
