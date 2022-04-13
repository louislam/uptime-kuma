const { R } = require("redbean-node");
const { checkLogin, setSettings, setSetting } = require("../util-server");
const dayjs = require("dayjs");
const { debug } = require("../../src/util");
const ImageDataURI = require("../image-data-uri");
const Database = require("../database");
const apicache = require("../modules/apicache");
const StatusPage = require("../model/status_page");
const server = require("../server");

module.exports.statusPageSocketHandler = (socket) => {

    // Post or edit incident
    socket.on("postIncident", async (slug, incident, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);

            if (!statusPageID) {
                throw new Error("slug is not found");
            }

            await R.exec("UPDATE incident SET pin = 0 WHERE status_page_id = ? ", [
                statusPageID
            ]);

            let incidentBean;

            if (incident.id) {
                incidentBean = await R.findOne("incident", " id = ? AND status_page_id = ? ", [
                    incident.id,
                    statusPageID
                ]);
            }

            if (incidentBean == null) {
                incidentBean = R.dispense("incident");
            }

            incidentBean.title = incident.title;
            incidentBean.content = incident.content;
            incidentBean.style = incident.style;
            incidentBean.pin = true;
            incidentBean.status_page_id = statusPageID;

            if (incident.id) {
                incidentBean.lastUpdatedDate = R.isoDateTime(dayjs.utc());
            } else {
                incidentBean.createdDate = R.isoDateTime(dayjs.utc());
            }

            await R.store(incidentBean);

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

            // Save Config
            let statusPage = await R.findOne("status_page", " slug = ? ", [
                slug
            ]);

            if (!statusPage) {
                throw new Error("No slug?");
            }

            checkSlug(config.slug);

            const header = "data:image/png;base64,";

            // Check logo format
            // If is image data url, convert to png file
            // Else assume it is a url, nothing to do
            if (imgDataUrl.startsWith("data:")) {
                if (! imgDataUrl.startsWith(header)) {
                    throw new Error("Only allowed PNG logo.");
                }

                const filename = `logo${statusPage.id}.png`;

                // Convert to file
                await ImageDataURI.outputFile(imgDataUrl, Database.uploadDir + filename);
                config.logo = `/upload/${filename}?t=` + Date.now();

            } else {
                config.icon = imgDataUrl;
            }

            statusPage.slug = config.slug;
            statusPage.title = config.title;
            statusPage.description = config.description;
            statusPage.icon = config.logo;
            statusPage.theme = config.theme;
            //statusPage.published = ;
            //statusPage.search_engine_index = ;
            statusPage.show_tags = config.showTags;
            //statusPage.password = null;
            statusPage.modified_date = R.isoDateTime();

            await R.store(statusPage);

            await statusPage.updateDomainNameList(config.domainNameList);
            await StatusPage.loadDomainMappingList();

            // Save Public Group List
            const groupIDList = [];
            let groupOrder = 1;

            for (let group of publicGroupList) {
                let groupBean;
                if (group.id) {
                    groupBean = await R.findOne("group", " id = ? AND public = 1 AND status_page_id = ? ", [
                        group.id,
                        statusPage.id
                    ]);
                } else {
                    groupBean = R.dispense("group");
                }

                groupBean.status_page_id = statusPage.id;
                groupBean.name = group.name;
                groupBean.public = true;
                groupBean.weight = groupOrder++;

                await R.store(groupBean);

                await R.exec("DELETE FROM monitor_group WHERE group_id = ? ", [
                    groupBean.id
                ]);

                let monitorOrder = 1;

                for (let monitor of group.monitorList) {
                    let relationBean = R.dispense("monitor_group");
                    relationBean.weight = monitorOrder++;
                    relationBean.group_id = groupBean.id;
                    relationBean.monitor_id = monitor.id;
                    await R.store(relationBean);
                }

                groupIDList.push(groupBean.id);
                group.id = groupBean.id;
            }

            // Delete groups that not in the list
            debug("Delete groups that not in the list");
            const slots = groupIDList.map(() => "?").join(",");

            const data = [
                ...groupIDList,
                statusPage.id
            ];
            await R.exec(`DELETE FROM \`group\` WHERE id NOT IN (${slots}) AND status_page_id = ?`, data);

            // Also change entry page to new slug if it is the default one, and slug is changed.
            if (server.entryPage === "statusPage-" + slug && statusPage.slug !== slug) {
                server.entryPage = "statusPage-" + statusPage.slug;
                await setSetting("entryPage", server.entryPage, "general");
            }

            apicache.clear();

            callback({
                ok: true,
                publicGroupList,
            });

        } catch (error) {
            console.error(error);

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

            // Check empty
            if (!title || !slug) {
                throw new Error("Please input all fields");
            }

            // Make sure slug is string
            if (typeof slug !== "string") {
                throw new Error("Slug -Accept string only");
            }

            // lower case only
            slug = slug.toLowerCase();

            checkSlug(slug);

            let statusPage = R.dispense("status_page");
            statusPage.slug = slug;
            statusPage.title = title;
            statusPage.theme = "light";
            statusPage.icon = "";
            await R.store(statusPage);

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

/**
 * Check slug a-z, 0-9, - only
 * Regex from: https://stackoverflow.com/questions/22454258/js-regex-string-validation-for-slug
 */
function checkSlug(slug) {
    if (typeof slug !== "string") {
        throw new Error("Slug must be string");
    }

    slug = slug.trim();

    if (!slug) {
        throw new Error("Slug cannot be empty");
    }

    if (!slug.match(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/)) {
        throw new Error("Invalid Slug");
    }
}
