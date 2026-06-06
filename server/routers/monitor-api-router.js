const express = require("express");
const { R } = require("redbean-node");
const { log } = require("../../src/util");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { resolveAPIKeyUser } = require("../auth");
const Monitor = require("../model/monitor");
const apicache = require("../modules/apicache");

let router = express.Router();

const server = UptimeKumaServer.getInstance();

/**
 * Authenticate request via API key and set req.userID
 * @param {express.Request} req Express request
 * @param {express.Response} res Express response
 * @param {express.NextFunction} next Next handler
 * @returns {Promise<void>}
 */
async function apiKeyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return res.status(401).json({ ok: false, msg: "Unauthorized" });
    }

    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    // Basic auth format is "username:password" — the API key is the password
    const colonIndex = decoded.indexOf(":");
    const apiKey = decoded.substring(colonIndex + 1);

    const user = await resolveAPIKeyUser(apiKey);
    if (!user) {
        log.warn("monitor-api", "Invalid API key");
        return res.status(401).json({ ok: false, msg: "Invalid API key" });
    }

    req.userID = user.userId;
    next();
}

/**
 * Prepare monitor input data for DB storage (replicate socket add/edit handler transforms)
 * @param {object} monitor Raw monitor data from request body
 * @returns {object} Transformed monitor data ready for bean.import()
 */
function prepareMonitorData(monitor) {
    let data = Object.assign({}, monitor);

    data.accepted_statuscodes_json = JSON.stringify(data.accepted_statuscodes || [ "200-299" ]);
    delete data.accepted_statuscodes;

    data.kafkaProducerBrokers = JSON.stringify(data.kafkaProducerBrokers || []);
    data.kafkaProducerSaslOptions = JSON.stringify(data.kafkaProducerSaslOptions || {});
    data.rabbitmqNodes = JSON.stringify(data.rabbitmqNodes || []);
    data.conditions = JSON.stringify(data.conditions || []);

    const stripProperties = [
        "humanReadableInterval",
        "globalpingdnsresolvetypeoptions",
        "responsecheck",
        "notificationIDs",
        "notificationNames",
        // Server-controlled — never trust from client
        "id",
        "user_id",
    ];
    for (const prop of stripProperties) {
        delete data[prop];
    }

    return data;
}

/**
 * Resolve notification IDs from the request body.
 * Accepts notificationIDs (array of numeric IDs) or notificationNames (array of names).
 * @param {object} body Request body
 * @param {number} userID Owner user ID (used to scope name lookups and validate ownership)
 * @returns {Promise<object>} notificationIDList map { id: true }
 */
async function resolveNotifications(body, userID) {
    const idList = {};

    if (Array.isArray(body.notificationIDs)) {
        for (const id of body.notificationIDs) {
            // Validate ownership
            let notif = await R.findOne("notification", " id = ? AND user_id = ? ", [ id, userID ]);
            if (notif) {
                idList[id] = true;
            }
        }
    }

    if (Array.isArray(body.notificationNames)) {
        for (const name of body.notificationNames) {
            let notif = await R.findOne("notification", " name = ? AND user_id = ? ", [ name, userID ]);
            if (notif) {
                idList[notif.id] = true;
            }
        }
    }

    return idList;
}

/**
 * Validate that a parent monitor ID belongs to the requesting user
 * @param {number|null|undefined} parentID Parent monitor ID from request body
 * @param {number} userID Authenticated user ID
 * @returns {Promise<void>}
 * @throws {Error} If parent is set but not owned by the user
 */
async function validateParent(parentID, userID) {
    if (!parentID) {
        return;
    }
    const parent = await R.findOne("monitor", " id = ? AND user_id = ? ", [ parentID, userID ]);
    if (!parent) {
        throw new Error("Invalid parent monitor");
    }
}

// All routes below require API key authentication
router.use(apiKeyAuth);

/**
 * List all monitors for the authenticated user
 */
router.get("/api/monitors", async (req, res) => {
    try {
        let list = await server.getMonitorJSONList(req.userID);
        res.json({ ok: true, monitors: Object.values(list) });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * Create a new monitor
 */
router.post("/api/monitors", async (req, res) => {
    try {
        await validateParent(req.body.parent, req.userID);

        let bean = R.dispense("monitor");
        let monitorData = prepareMonitorData(req.body);

        bean.import(monitorData);

        // camelCase → snake_case mappings not handled by bean.import()
        if (req.body.retryOnlyOnStatusCodeFailure !== undefined) {
            bean.retry_only_on_status_code_failure = req.body.retryOnlyOnStatusCodeFailure;
        }

        // Re-assert server-controlled fields after mass import
        bean.user_id = req.userID;
        bean.validate();

        await R.store(bean);

        let notificationIDList = await resolveNotifications(req.body, req.userID);
        await server.updateMonitorNotification(bean.id, notificationIDList);

        if (req.body.active !== false) {
            await server.startMonitor(req.userID, bean.id);
        }

        log.info("monitor-api", `Created monitor: ${bean.id} User ID: ${req.userID}`);
        res.status(201).json({ ok: true, monitorID: bean.id });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(422).json({ ok: false, msg: e.message });
    }
});

/**
 * Get a single monitor by ID
 */
router.get("/api/monitors/:id", async (req, res) => {
    try {
        let monitorID = parseInt(req.params.id);
        let list = await server.getMonitorJSONList(req.userID, monitorID);

        if (!list[monitorID]) {
            return res.status(404).json({ ok: false, msg: "Monitor not found" });
        }

        res.json({ ok: true, monitor: list[monitorID] });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * Update an existing monitor
 */
router.put("/api/monitors/:id", async (req, res) => {
    try {
        let monitorID = parseInt(req.params.id);
        let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [ monitorID, req.userID ]);

        if (!bean) {
            return res.status(404).json({ ok: false, msg: "Monitor not found" });
        }

        await validateParent(req.body.parent, req.userID);

        let monitorData = prepareMonitorData(req.body);
        bean.import(monitorData);

        if (req.body.retryOnlyOnStatusCodeFailure !== undefined) {
            bean.retry_only_on_status_code_failure = req.body.retryOnlyOnStatusCodeFailure;
        }

        // Re-assert server-controlled fields after mass import
        bean.id = monitorID;
        bean.user_id = req.userID;

        bean.validate();
        await R.store(bean);

        let notificationIDList = await resolveNotifications(req.body, req.userID);
        await server.updateMonitorNotification(bean.id, notificationIDList);

        if (await Monitor.isActive(bean.id, bean.active)) {
            await server.restartMonitor(req.userID, bean.id);
        }

        apicache.clear();

        log.info("monitor-api", `Updated monitor: ${bean.id} User ID: ${req.userID}`);
        res.json({ ok: true, monitorID: bean.id });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(422).json({ ok: false, msg: e.message });
    }
});

/**
 * Delete a monitor
 * Query param: deleteChildren=true to also delete child monitors (for group monitors)
 */
router.delete("/api/monitors/:id", async (req, res) => {
    try {
        let monitorID = parseInt(req.params.id);
        let deleteChildren = req.query.deleteChildren === "true";

        const monitor = await R.findOne("monitor", " id = ? AND user_id = ? ", [ monitorID, req.userID ]);

        if (!monitor) {
            return res.status(404).json({ ok: false, msg: "Monitor not found" });
        }

        if (monitor.type === "group") {
            const children = await Monitor.getChildren(monitorID);

            if (deleteChildren) {
                if (children && children.length > 0) {
                    for (const child of children) {
                        await Monitor.deleteMonitorRecursively(child.id, req.userID);
                    }
                }
            } else {
                await Monitor.unlinkAllChildren(monitorID);
            }
        }

        await Monitor.deleteMonitor(monitorID, req.userID);
        apicache.clear();

        log.info("monitor-api", `Deleted monitor: ${monitorID} User ID: ${req.userID}`);
        res.json({ ok: true, msg: "Monitor deleted" });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * List notifications for the authenticated user (for name→id resolution)
 */
router.get("/api/notifications", async (req, res) => {
    try {
        let list = await R.find("notification", " user_id = ? ORDER BY name", [ req.userID ]);
        let result = list.map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            active: Boolean(n.active),
        }));
        res.json({ ok: true, notifications: result });
    } catch (e) {
        log.error("monitor-api", e);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

module.exports = router;
