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

        // TODO:

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
        const monitorList = {};
        let list = await R.find("monitor", " public = 1 ORDER BY weight DESC, name ", [
        ]);

        for (let monitor of list) {
            monitorList[monitor.id] = await monitor.toJSON();
        }

        response.json(monitorList);

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

        const monitorList = {};
        let list = await R.find("", "  ", [
        ])

        for (let monitor of list) {
            monitorList[monitor.id] = await monitor.toJSON();
        }

        response.json({
            monitorList: monitorList,
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
    })
}

module.exports = router;
