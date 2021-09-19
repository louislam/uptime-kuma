let express = require("express");
const { allowDevAllOrigin, getSettings, setting } = require("../util-server");
const { R } = require("redbean-node");
const server = require("../server");
let router = express.Router();

router.get("/api/entry-page", async (_, response) => {
    allowDevAllOrigin(response);
    response.json(server.entryPage);
});

// Status Page Config
router.get("/api/status-page/config", async (_request, response) => {
    allowDevAllOrigin(response);

    let config = getSettings("statusPage");

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
router.get("/api/status-page/monitor-list", async (_request, response) => {
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
router.get("/api/status-page/heartbeat", async (_request, response) => {
    allowDevAllOrigin(response);
    try {
        await checkPublished();

        let heartbeatList = {};

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
                    LIMIT 100
            `, [
                monitorID,
            ]);

            list = R.convertToBeans("heartbeat", list);
            heartbeatList[monitorID] = list.reverse().map(row => row.toPublicJSON());
        }

        response.json({
            heartbeatList,
        });

    } catch (error) {
        send403(response, error.message);
    }
});

router.post("/api/status-page/upload-logo", async (request, response) => {
    allowDevAllOrigin(response);

    // TODO: Check Bearer token

    console.log(request);

    response.json({});
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
