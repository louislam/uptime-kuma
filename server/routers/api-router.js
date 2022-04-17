let express = require("express");
const { allowDevAllOrigin } = require("../util-server");
const { R } = require("redbean-node");
const server = require("../server");
const apicache = require("../modules/apicache");
const Monitor = require("../model/monitor");
const dayjs = require("dayjs");
const { UP, flipStatus, log } = require("../../src/util");
const StatusPage = require("../model/status_page");
let router = express.Router();

let cache = apicache.middleware;
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

        let monitor = await R.findOne("monitor", " push_token = ? AND active = 1 ", [
            pushToken
        ]);

        if (! monitor) {
            throw new Error("Monitor not found or not active.");
        }

        const previousHeartbeat = await Monitor.getPreviousHeartbeat(monitor.id);

        let status = UP;
        if (monitor.isUpsideDown()) {
            status = flipStatus(status);
        }

        let isFirstBeat = true;
        let previousStatus = status;
        let duration = 0;

        let bean = R.dispense("heartbeat");
        bean.time = R.isoDateTime(dayjs.utc());

        if (previousHeartbeat) {
            isFirstBeat = false;
            previousStatus = previousHeartbeat.status;
            duration = dayjs(bean.time).diff(dayjs(previousHeartbeat.time), "second");
        }

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
        response.json({
            ok: false,
            msg: e.message
        });
    }
});

// Status page config, incident, monitor list
router.get("/api/status-page/:slug", cache("5 minutes"), async (request, response) => {
    allowDevAllOrigin(response);
    let slug = request.params.slug;

    // Get Status Page
    let statusPage = await R.findOne("status_page", " slug = ? ", [
        slug
    ]);

    if (!statusPage) {
        response.statusCode = 404;
        response.json({
            msg: "Not Found"
        });
        return;
    }

    try {
        // Incident
        let incident = await R.findOne("incident", " pin = 1 AND active = 1 AND status_page_id = ? ", [
            statusPage.id,
        ]);

        if (incident) {
            incident = incident.toPublicJSON();
        }

        // Public Group List
        const publicGroupList = [];
        const showTags = !!statusPage.show_tags;

        const list = await R.find("group", " public = 1 AND status_page_id = ? ORDER BY weight ", [
            statusPage.id
        ]);

        for (let groupBean of list) {
            let monitorGroup = await groupBean.toPublicJSON(showTags);
            publicGroupList.push(monitorGroup);
        }

        // Response
        response.json({
            config: await statusPage.toPublicJSON(),
            incident,
            publicGroupList
        });

    } catch (error) {
        send403(response, error.message);
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
        let statusPageID = await StatusPage.slugToID(slug);

        let monitorIDList = await R.getCol(`
            SELECT monitor_group.monitor_id FROM monitor_group, \`group\`
            WHERE monitor_group.group_id = \`group\`.id
            AND public = 1
            AND \`group\`.status_page_id = ?
        `, [
            statusPageID
        ]);

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

function send403(res, msg = "") {
    res.status(403).json({
        "status": "fail",
        "msg": msg,
    });
}

module.exports = router;
