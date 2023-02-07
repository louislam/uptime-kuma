const { R } = require("redbean-node");
const { checkLogin, setSetting } = require("../util-server");
const { log } = require("../../src/util");
const apicache = require("../modules/apicache");
const StatusPage = require("../model/status_page");
const Incident = require("../model/incident");
const { UptimeKumaServer } = require("../uptime-kuma-server");

/**
 * Socket handlers for status page
 * @param {Socket} socket Socket.io instance to add listeners on
 */
module.exports.statusPageSocketHandler = (socket) => {

    // Post or edit incident
    socket.on("postIncident", async (slug, incident, callback) => {
        try {
            checkLogin(socket);

            const incidentBean = await Incident.save(slug, incident);

            callback({
                ok: true,
                incident: incidentBean.toPublicJSON(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("unpinIncident", async (slug, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);

            await R.exec("UPDATE incident SET pin = 0 WHERE pin = 1 AND status_page_id = ? ", [
                statusPageID
            ]);

            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("getStatusPage", async (slug, callback) => {
        try {
            checkLogin(socket);

            let statusPage = await R.findOne("status_page", " slug = ? ", [
                slug
            ]);

            if (!statusPage) {
                throw new Error("No slug?");
            }

            callback({
                ok: true,
                config: await statusPage.toJSON(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    // Save Status Page
    // imgDataUrl Only Accept PNG!
    socket.on("saveStatusPage", async (slug, config, imgDataUrl, publicGroupList, callback) => {
        try {
            checkLogin(socket);

            await StatusPage.save(slug, config, imgDataUrl, publicGroupList);

            apicache.clear();

            callback({
                ok: true,
                publicGroupList,
            });

        } catch (error) {
            log.error("socket", error);

            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    // Add a new status page
    socket.on("addStatusPage", async (title, slug, callback) => {
        try {
            checkLogin(socket);

            title = title?.trim();
            slug = slug?.trim();

            await StatusPage.create(title, slug);

            callback({
                ok: true,
                msg: "OK!"
            });

        } catch (error) {
            console.error(error);
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    // Delete a status page
    socket.on("deleteStatusPage", async (slug, callback) => {
        const server = UptimeKumaServer.getInstance();

        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);

            if (statusPageID) {

                // Reset entry page if it is the default one.
                if (server.entryPage === "statusPage-" + slug) {
                    server.entryPage = "dashboard";
                    await setSetting("entryPage", server.entryPage, "general");
                }

                // No need to delete records from `status_page_cname`, because it has cascade foreign key.
                // But for incident & group, it is hard to add cascade foreign key during migration, so they have to be deleted manually.

                // Delete incident
                await R.exec("DELETE FROM incident WHERE status_page_id = ? ", [
                    statusPageID
                ]);

                // Delete group
                await R.exec("DELETE FROM `group` WHERE status_page_id = ? ", [
                    statusPageID
                ]);

                // Delete status_page
                await R.exec("DELETE FROM status_page WHERE id = ? ", [
                    statusPageID
                ]);

            } else {
                throw new Error("Status Page is not found");
            }

            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });
};
