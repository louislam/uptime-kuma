let express = require("express");
const { allowDevAllOrigin, getSettings } = require("../util-server");
const { R } = require("redbean-node");
let router = express.Router();

// Status Page Config
router.get("/api/status-page/config", async (_request, response) => {
    allowDevAllOrigin(response);
    let config = getSettings("statusPage");

    if (! config.statusPageTheme) {
        config.statusPageTheme = "light";
    }

    response.json(config);
});

// Status Page - Monitor List
router.get("/api/status-page/monitor-list", async (_request, response) => {
    allowDevAllOrigin(response);

    const monitorList = {};
    let list = await R.find("monitor", " public = 1 ORDER BY weight DESC, name ", [
    ]);

    for (let monitor of list) {
        monitorList[monitor.id] = await monitor.toJSON();
    }

    response.json(monitorList);
});

// Status Page Polling Data
router.get("/api/status-page/heartbeat", async (_request, response) => {
    allowDevAllOrigin(response);

    const monitorList = {};
    let list = await R.find("", "  ", [
    ])

    for (let monitor of list) {
        monitorList[monitor.id] = await monitor.toJSON();
    }

    response.json({
        monitorList: monitorList,
    });
});

module.exports = router;
