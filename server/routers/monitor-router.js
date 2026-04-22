let express = require("express");
const { R } = require("redbean-node");
const { apiAuth, resolveUserFromApi } = require("../auth");
const { log, genSecret } = require("../../src/util");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const Monitor = require("../model/monitor");

let router = express.Router();

// All monitor REST endpoints require API auth + user resolution
router.use("/api/monitors", apiAuth, resolveUserFromApi);

/**
 * GET /api/monitors — List all monitors for the authenticated user
 */
router.get("/api/monitors", async (req, res) => {
    try {
        const server = UptimeKumaServer.getInstance();
        let list = await server.getMonitorJSONList(req.userID);
        res.json({ ok: true, monitors: Object.values(list) });
    } catch (e) {
        log.error("api-monitors", e.message);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * GET /api/monitors/:id — Get a single monitor
 */
router.get("/api/monitors/:id", async (req, res) => {
    try {
        const server = UptimeKumaServer.getInstance();
        let list = await server.getMonitorJSONList(req.userID, parseInt(req.params.id, 10));
        let monitor = list[req.params.id];
        if (!monitor) {
            return res.status(404).json({ ok: false, msg: "Monitor not found." });
        }
        res.json({ ok: true, monitor });
    } catch (e) {
        log.error("api-monitors", e.message);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * POST /api/monitors — Create a new monitor
 */
router.post("/api/monitors", async (req, res) => {
    try {
        const server = UptimeKumaServer.getInstance();
        let monitor = req.body;

        let bean = R.dispense("monitor");

        let notificationIDList = monitor.notificationIDList;
        delete monitor.notificationIDList;

        // Ensure accepted_statuscodes is an array of strings if provided
        if (monitor.accepted_statuscodes) {
            if (!Array.isArray(monitor.accepted_statuscodes) ||
                !monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                throw new Error("accepted_statuscodes must be an array of strings");
            }
            monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
            delete monitor.accepted_statuscodes;
        }

        // Stringify JSON fields if provided as objects
        const jsonFields = ["kafkaProducerBrokers", "kafkaProducerSaslOptions", "conditions", "rabbitmqNodes"];
        for (const field of jsonFields) {
            if (monitor[field] !== undefined && typeof monitor[field] !== "string") {
                monitor[field] = JSON.stringify(monitor[field]);
            }
        }

        // Remove frontend-only properties
        const frontendOnlyProperties = ["humanReadableInterval", "globalpingdnsresolvetypeoptions", "responsecheck"];
        for (const prop of frontendOnlyProperties) {
            delete monitor[prop];
        }

        bean.import(monitor);

        if (monitor.retryOnlyOnStatusCodeFailure !== undefined) {
            bean.retry_only_on_status_code_failure = monitor.retryOnlyOnStatusCodeFailure;
        }

        bean.user_id = req.userID;

        // Server-side pushToken generation for push monitors
        if (bean.type === "push" && !bean.pushToken) {
            bean.pushToken = genSecret(32);
        }

        bean.validate();
        await R.store(bean);

        if (notificationIDList) {
            await updateMonitorNotification(bean.id, notificationIDList);
        }

        if (monitor.active !== false) {
            await startMonitor(req.userID, bean.id);
        }

        log.info("api-monitors", `Created monitor ${bean.id} for user ${req.userID}`);

        // Return the created monitor with full data
        let list = await server.getMonitorJSONList(req.userID, bean.id);
        res.status(201).json({
            ok: true,
            msg: "successAdded",
            monitorID: bean.id,
            monitor: list[bean.id],
        });
    } catch (e) {
        log.error("api-monitors", e.message);
        res.status(400).json({ ok: false, msg: e.message });
    }
});

/**
 * PUT /api/monitors/:id — Update an existing monitor
 */
router.put("/api/monitors/:id", async (req, res) => {
    try {
        const server = UptimeKumaServer.getInstance();
        let monitorID = parseInt(req.params.id, 10);
        let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, req.userID]);
        if (!bean) {
            return res.status(404).json({ ok: false, msg: "Monitor not found." });
        }

        let monitor = req.body;
        let notificationIDList = monitor.notificationIDList;
        delete monitor.notificationIDList;

        if (monitor.accepted_statuscodes) {
            if (!Array.isArray(monitor.accepted_statuscodes) ||
                !monitor.accepted_statuscodes.every((code) => typeof code === "string")) {
                throw new Error("accepted_statuscodes must be an array of strings");
            }
            monitor.accepted_statuscodes_json = JSON.stringify(monitor.accepted_statuscodes);
            delete monitor.accepted_statuscodes;
        }

        const jsonFields = ["kafkaProducerBrokers", "kafkaProducerSaslOptions", "conditions", "rabbitmqNodes"];
        for (const field of jsonFields) {
            if (monitor[field] !== undefined && typeof monitor[field] !== "string") {
                monitor[field] = JSON.stringify(monitor[field]);
            }
        }

        const frontendOnlyProperties = ["humanReadableInterval", "globalpingdnsresolvetypeoptions", "responsecheck"];
        for (const prop of frontendOnlyProperties) {
            delete monitor[prop];
        }

        // Don't allow changing user_id or id
        delete monitor.user_id;
        delete monitor.id;

        bean.import(monitor);

        if (monitor.retryOnlyOnStatusCodeFailure !== undefined) {
            bean.retry_only_on_status_code_failure = monitor.retryOnlyOnStatusCodeFailure;
        }

        bean.validate();
        await R.store(bean);

        if (notificationIDList) {
            await updateMonitorNotification(bean.id, notificationIDList);
        }

        if (bean.active) {
            await restartMonitor(req.userID, bean.id);
        }

        log.info("api-monitors", `Updated monitor ${bean.id} for user ${req.userID}`);

        let list = await server.getMonitorJSONList(req.userID, bean.id);
        res.json({
            ok: true,
            msg: "successEdited",
            monitorID: bean.id,
            monitor: list[bean.id],
        });
    } catch (e) {
        log.error("api-monitors", e.message);
        res.status(400).json({ ok: false, msg: e.message });
    }
});

/**
 * DELETE /api/monitors/:id — Delete a monitor
 */
router.delete("/api/monitors/:id", async (req, res) => {
    try {
        let monitorID = parseInt(req.params.id, 10);
        let bean = await R.findOne("monitor", " id = ? AND user_id = ? ", [monitorID, req.userID]);
        if (!bean) {
            return res.status(404).json({ ok: false, msg: "Monitor not found." });
        }

        let deleteChildren = req.query.deleteChildren === "true";
        if (deleteChildren) {
            await Monitor.deleteMonitorRecursively(monitorID, req.userID);
        } else {
            // Unlink children if it's a group monitor
            if (bean.type === "group") {
                await R.exec("UPDATE monitor SET parent = NULL WHERE parent = ? ", [monitorID]);
            }
            await Monitor.deleteMonitor(monitorID, req.userID);
        }

        log.info("api-monitors", `Deleted monitor ${monitorID} for user ${req.userID}`);
        res.json({ ok: true, msg: "successDeleted" });
    } catch (e) {
        log.error("api-monitors", e.message);
        res.status(500).json({ ok: false, msg: e.message });
    }
});

/**
 * Helper: update monitor notification links (same as server.js)
 * @param {number} monitorID Monitor ID
 * @param {object} notificationIDList Notification ID list
 */
async function updateMonitorNotification(monitorID, notificationIDList) {
    await R.exec("DELETE FROM monitor_notification WHERE monitor_id = ? ", [monitorID]);
    for (let notificationID in notificationIDList) {
        if (notificationIDList[notificationID]) {
            let relation = R.dispense("monitor_notification");
            relation.monitor_id = monitorID;
            relation.notification_id = notificationID;
            await R.store(relation);
        }
    }
}

/**
 * Helper: start a monitor (mirrors server.js startMonitor)
 * @param {number} userID User ID
 * @param {number} monitorID Monitor ID
 */
async function startMonitor(userID, monitorID) {
    const server = UptimeKumaServer.getInstance();
    await R.exec("UPDATE monitor SET active = 1 WHERE id = ? AND user_id = ? ", [monitorID, userID]);
    let monitor = await R.findOne("monitor", " id = ? ", [monitorID]);
    if (monitor.id in server.monitorList) {
        await server.monitorList[monitor.id].stop();
    }
    server.monitorList[monitor.id] = monitor;
    await monitor.start(server.io);
}

/**
 * Helper: restart a monitor
 * @param {number} userID User ID
 * @param {number} monitorID Monitor ID
 */
async function restartMonitor(userID, monitorID) {
    return await startMonitor(userID, monitorID);
}

module.exports = router;
