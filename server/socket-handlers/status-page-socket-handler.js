const { getKnex } = require("../db");
const { isoDateTime } = require("../utils/iso-datetime");
const Incident = require("../model/incident");
const Group = require("../model/group");
const { checkLogin } = require("../util-server");
const dayjs = require("dayjs");
const { log } = require("../../src/util");
const ImageDataURI = require("../image-data-uri");
const Database = require("../database");
const apicache = require("../modules/apicache");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { Settings } = require("../settings");

/**
 * Validates incident data
 * @param {object} incident - The incident object
 * @returns {void}
 * @throws {Error} If validation fails
 */
function validateIncident(incident) {
    if (!incident.title || incident.title.trim() === "") {
        throw new Error("Please input title");
    }
    if (!incident.content || incident.content.trim() === "") {
        throw new Error("Please input content");
    }
}

/**
 * Socket handlers for status page
 * @param {Socket} socket Socket.io instance to add listeners on
 * @returns {void}
 */
module.exports.statusPageSocketHandler = (socket) => {
    // Post or edit incident
    socket.on("postIncident", async (slug, incident, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);

            if (!statusPageID) {
                throw new Error("slug is not found");
            }

            let incidentBean = null;
            if (incident.id) {
                incidentBean = await Incident.query().where({ id: incident.id,
                    status_page_id: statusPageID }).first();
            }

            const payload = {
                title: incident.title,
                content: incident.content,
                style: incident.style,
                pin: true,
                active: true,
                status_page_id: statusPageID,
            };

            if (incidentBean) {
                payload.last_updated_date = isoDateTime(dayjs.utc());
                incidentBean = await incidentBean.$query().patchAndFetch(payload);
            } else {
                payload.created_date = isoDateTime(dayjs.utc());
                incidentBean = await Incident.query().insertAndFetch(payload);
            }

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

            await getKnex()("incident").where({ pin: true,
                status_page_id: statusPageID }).update({ pin: false });

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

    socket.on("getIncidentHistory", async (slug, cursor, callback) => {
        try {
            let statusPageID = await StatusPage.slugToID(slug);
            if (!statusPageID) {
                throw new Error("slug is not found");
            }

            const isPublic = !socket.userID;
            const result = await StatusPage.getIncidentHistory(statusPageID, cursor, isPublic);
            callback({
                ok: true,
                ...result,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("editIncident", async (slug, incidentID, incident, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);
            if (!statusPageID) {
                callback({
                    ok: false,
                    msg: "slug is not found",
                    msgi18n: true,
                });
                return;
            }

            let bean = await Incident.query().where({ id: incidentID,
                status_page_id: statusPageID }).first();
            if (!bean) {
                callback({
                    ok: false,
                    msg: "Incident not found or access denied",
                    msgi18n: true,
                });
                return;
            }

            try {
                validateIncident(incident);
            } catch (e) {
                callback({
                    ok: false,
                    msg: e.message,
                    msgi18n: true,
                });
                return;
            }

            const validStyles = ["info", "warning", "danger", "primary", "light", "dark"];
            if (!validStyles.includes(incident.style)) {
                incident.style = "warning";
            }

            bean = await bean.$query().patchAndFetch({
                title: incident.title,
                content: incident.content,
                style: incident.style,
                pin: incident.pin !== false,
                last_updated_date: isoDateTime(dayjs.utc()),
            });

            callback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                incident: bean.toPublicJSON(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
                msgi18n: true,
            });
        }
    });

    socket.on("deleteIncident", async (slug, incidentID, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);
            if (!statusPageID) {
                callback({
                    ok: false,
                    msg: "slug is not found",
                    msgi18n: true,
                });
                return;
            }

            const deleted = await Incident.query().where({ id: incidentID,
                status_page_id: statusPageID }).delete();
            if (deleted === 0) {
                callback({
                    ok: false,
                    msg: "Incident not found or access denied",
                    msgi18n: true,
                });
                return;
            }

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
                msgi18n: true,
            });
        }
    });

    socket.on("resolveIncident", async (slug, incidentID, callback) => {
        try {
            checkLogin(socket);

            let statusPageID = await StatusPage.slugToID(slug);
            if (!statusPageID) {
                callback({
                    ok: false,
                    msg: "slug is not found",
                    msgi18n: true,
                });
                return;
            }

            let bean = await Incident.query().where({ id: incidentID,
                status_page_id: statusPageID }).first();
            if (!bean) {
                callback({
                    ok: false,
                    msg: "Incident not found or access denied",
                    msgi18n: true,
                });
                return;
            }

            await bean.resolve();

            callback({
                ok: true,
                msg: "Resolved",
                msgi18n: true,
                incident: bean.toPublicJSON(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
                msgi18n: true,
            });
        }
    });

    socket.on("getStatusPage", async (slug, callback) => {
        try {
            checkLogin(socket);

            let statusPage = await StatusPage.query().where("slug", slug).first();

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
            let statusPage = await StatusPage.query().where("slug", slug).first();

            if (!statusPage) {
                throw new Error("No slug?");
            }

            checkSlug(config.slug);

            const header = "data:image/png;base64,";

            // Check logo format
            // If is image data url, convert to png file
            // Else assume it is a url, nothing to do
            if (imgDataUrl.startsWith("data:")) {
                if (!imgDataUrl.startsWith(header)) {
                    throw new Error("Only allowed PNG logo.");
                }

                const filename = `logo${statusPage.id}.png`;

                // Convert to file
                await ImageDataURI.outputFile(imgDataUrl, Database.uploadDir + filename);
                config.logo = `/upload/${filename}?t=` + Date.now();
            } else {
                config.logo = imgDataUrl;
            }

            const validAnalyticsTypes = ["google", "umami", "plausible", "matomo"];
            if (config.analyticsType !== null && !validAnalyticsTypes.includes(config.analyticsType)) {
                throw new Error("Invalid analytics type");
            }

            const statusPagePayload = {
                slug: config.slug,
                title: config.title,
                description: config.description,
                icon: config.logo,
                autoRefreshInterval: config.autoRefreshInterval,
                theme: config.theme,
                show_tags: config.showTags,
                footer_text: config.footerText,
                custom_css: config.customCSS,
                show_powered_by: config.showPoweredBy,
                rss_title: config.rssTitle,
                show_only_last_heartbeat: config.showOnlyLastHeartbeat,
                show_certificate_expiry: config.showCertificateExpiry,
                modified_date: isoDateTime(),
                analytics_id: config.analyticsId,
                analytics_script_url: config.analyticsScriptUrl,
                analytics_type: config.analyticsType,
            };

            Object.assign(statusPage, statusPagePayload);

            await statusPage.$query().patchAndFetch(statusPagePayload);

            await statusPage.updateDomainNameList(config.domainNameList);
            await StatusPage.loadDomainMappingList();

            // Save Public Group List
            const groupIDList = [];
            let groupOrder = 1;

            const knex = getKnex();
            for (let group of publicGroupList) {
                const payload = {
                    status_page_id: statusPage.id,
                    name: group.name,
                    public: true,
                    weight: groupOrder++,
                };

                let groupBean;
                if (group.id) {
                    groupBean = await Group.query().where({ id: group.id,
                        public: true,
                        status_page_id: statusPage.id }).first();
                }

                if (groupBean) {
                    groupBean = await groupBean.$query().patchAndFetch(payload);
                } else {
                    groupBean = await Group.query().insertAndFetch(payload);
                }

                await knex("monitor_group").where("group_id", groupBean.id).delete();

                let monitorOrder = 1;

                for (let monitor of group.monitorList) {
                    const relationPayload = {
                        weight: monitorOrder++,
                        group_id: groupBean.id,
                        monitor_id: monitor.id,
                    };
                    if (monitor.sendUrl !== undefined) {
                        relationPayload.send_url = monitor.sendUrl;
                    }
                    if (monitor.url !== undefined) {
                        relationPayload.custom_url = monitor.url;
                    }
                    await knex("monitor_group").insert(relationPayload);
                }

                groupIDList.push(groupBean.id);
                group.id = groupBean.id;
            }

            // Delete groups that are not in the list
            log.debug("socket", "Delete groups that are not in the list");
            if (groupIDList.length === 0) {
                await knex("group").where("status_page_id", statusPage.id).delete();
            } else {
                await knex("group")
                    .where("status_page_id", statusPage.id)
                    .whereNotIn("id", groupIDList)
                    .delete();
            }

            const server = UptimeKumaServer.getInstance();

            // Also change entry page to new slug if it is the default one, and slug is changed.
            if (server.entryPage === "statusPage-" + slug && statusPage.slug !== slug) {
                server.entryPage = "statusPage-" + statusPage.slug;
                await Settings.set("entryPage", server.entryPage, "general");
            }

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

            await StatusPage.query().insert({
                slug,
                title,
                theme: "auto",
                icon: "",
                auto_refresh_interval: 300,
            });

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
                slug: slug,
            });
        } catch (error) {
            log.error("socket", error);
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
                    await Settings.set("entryPage", server.entryPage, "general");
                }

                // No need to delete records from `status_page_cname`, because it has cascade foreign key.
                // But for incident & group, it is hard to add cascade foreign key during migration, so they have to be deleted manually.

                const knex = getKnex();
                // Delete incident
                await knex("incident").where("status_page_id", statusPageID).delete();
                // Delete group
                await knex("group").where("status_page_id", statusPageID).delete();
                // Delete status_page
                await knex("status_page").where("id", statusPageID).delete();

                apicache.clear();
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
 * @param {string} slug Slug to test
 * @returns {void}
 * @throws Slug is not valid
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
