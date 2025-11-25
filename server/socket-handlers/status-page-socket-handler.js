const { R } = require("redbean-node");
const { checkLogin, setSetting } = require("../util-server");
const dayjs = require("dayjs");
const { log } = require("../../src/util");
const ImageDataURI = require("../image-data-uri");
const Database = require("../database");
const apicache = require("../modules/apicache");
const StatusPage = require("../model/status_page");
const { UptimeKumaServer } = require("../uptime-kuma-server");

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

            // Check if this is a dynamic page and refresh monitors
            const dynamicConfigs = await R.find("dynamic_page_config", {
                status_page_id: statusPage.id
            });

            if (dynamicConfigs && dynamicConfigs.length > 0) {
                // This is a dynamic page, refresh monitors
                await refreshDynamicStatusPageMonitors(statusPage.id);
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
                config.logo = imgDataUrl;
            }

            statusPage.slug = config.slug;
            statusPage.title = config.title;
            statusPage.description = config.description;
            statusPage.icon = config.logo;
            statusPage.autoRefreshInterval = config.autoRefreshInterval,
            statusPage.theme = config.theme;
            //statusPage.published = ;
            //statusPage.search_engine_index = ;
            statusPage.show_tags = config.showTags;
            //statusPage.password = null;
            statusPage.footer_text = config.footerText;
            statusPage.custom_css = config.customCSS;
            statusPage.show_powered_by = config.showPoweredBy;
            statusPage.show_only_last_heartbeat = config.showOnlyLastHeartbeat;
            statusPage.show_certificate_expiry = config.showCertificateExpiry;
            statusPage.modified_date = R.isoDateTime();
            statusPage.google_analytics_tag_id = config.googleAnalyticsId;

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

                    if (monitor.sendUrl !== undefined) {
                        relationBean.send_url = monitor.sendUrl;
                    }

                    if (monitor.url !== undefined) {
                        relationBean.custom_url = monitor.url;
                    }

                    await R.store(relationBean);
                }

                groupIDList.push(groupBean.id);
                group.id = groupBean.id;
            }

            // Delete groups that are not in the list
            log.debug("socket", "Delete groups that are not in the list");
            if (groupIDList.length === 0) {
                await R.exec("DELETE FROM `group` WHERE status_page_id = ?", [ statusPage.id ]);
            } else {
                const slots = groupIDList.map(() => "?").join(",");

                const data = [
                    ...groupIDList,
                    statusPage.id
                ];
                await R.exec(`DELETE FROM \`group\` WHERE id NOT IN (${slots}) AND status_page_id = ?`, data);
            }

            const server = UptimeKumaServer.getInstance();

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
            log.error("socket", error);

            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    // Add a new status page with dynamic page support
    socket.on("addStatusPage", async (title, slug, isDynamic, tags, callback) => {
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
            statusPage.theme = "auto";
            statusPage.icon = "";
            statusPage.autoRefreshInterval = 300;
            await R.store(statusPage);

            const statusPageId = statusPage.id;

            // If dynamic page, save tags AND add monitors
            if (isDynamic && tags && tags.length > 0) {
                // Store dynamic page configuration
                await storeDynamicPageConfig(statusPageId, tags);

                // Automatically add monitors with matching tags to status page groups
                await addMonitorsByTagsToStatusPage(statusPageId, tags);
            }

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
                slug: slug
            });

        } catch (error) {
            console.error(error);
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    /**
     * Automatically add monitors with matching tags to dynamic status page using groups
     * @param {string} statusPageId - status page ID
     * @param {Array} tags - tags array
     * @returns {void}
     */
    async function addMonitorsByTagsToStatusPage(statusPageId, tags) {
        try {
            // Get monitors that match ALL the specified tags
            const monitors = await getMonitorsByTags(tags);

            if (!Array.isArray(monitors)) {
                return 0;
            }

            // Create or get a group for dynamic monitors
            let groupBean = await R.findOne("group", " status_page_id = ? AND name = ? ", [
                statusPageId,
                "Dynamic Monitors" // Hardcoded Dynamic Monitors Group
            ]);

            if (!groupBean) {
                groupBean = R.dispense("group");
                groupBean.status_page_id = statusPageId;
                groupBean.name = "Dynamic Monitors";
                groupBean.public = true;
                groupBean.weight = 1;
                await R.store(groupBean);
            }

            // Clear existing monitor-group relations for this group
            await R.exec("DELETE FROM monitor_group WHERE group_id = ?", [ groupBean.id ]);

            // Add monitors to the group
            let monitorOrder = 1;
            let addedCount = 0;

            for (const monitor of monitors) {
                let relationBean = R.dispense("monitor_group");
                relationBean.weight = monitorOrder++;
                relationBean.group_id = groupBean.id;
                relationBean.monitor_id = monitor.id;
                await R.store(relationBean);
                addedCount++;
            }

            return addedCount;

        } catch (error) {
            return 0;
        }
    }

    /**
     * Get monitors by tags
     * @param {Array} tags - tags array
     * @returns {Array} - returns matching monitors
     */
    async function getMonitorsByTags(tags) {
        if (!tags || tags.length === 0) {
            return [];
        }

        try {
            const knex = R.knex;

            // OR LOGIC: Monitor must have ANY of the specified tags (original behavior)
            const monitorIds = new Set();
            let query = knex("monitor_tag")
                .distinct("monitor_id");

            // Add conditions for each tag (OR logic)
            const conditions = [];

            tags.forEach((tag) => {
                if (!tag.tag_id) {
                    console.warn("Skipping tag with missing tag_id:", tag);
                    return;
                }

                if (tag.value && tag.value.trim() !== "") {
                    // Tag with specific value
                    conditions.push(
                        knex.raw("(tag_id = ? AND value = ?)", [ tag.tag_id, tag.value ])
                    );
                } else {
                    // Tag with any value or no value
                    conditions.push(
                        knex.raw("(tag_id = ? AND (value IS NULL OR value = ''))", [ tag.tag_id ])
                    );
                }
            });

            if (conditions.length > 0) {
                query.where(function () {
                    conditions.forEach(condition => {
                        this.orWhere(condition);
                    });
                });
            }

            const rows = await query;

            for (const row of rows) {
                monitorIds.add(row.monitor_id);
            }

            if (monitorIds.size === 0) {
                return [];
            }

            // Fetch active monitors by IDs from the monitor table
            const idArray = Array.from(monitorIds);
            const monitors = await knex("monitor")
                .select("id", "name", "active")
                .whereIn("id", idArray)
                .andWhere("active", 1);

            return monitors;

        } catch (error) {
            return [];
        }
    }

    // Helper function to store dynamic page configuration
    /**
     * @param {string} statusPageId - status page ID
     * @param {Array} tags - tags
     * @returns {void}
     */
    async function storeDynamicPageConfig(statusPageId, tags) {
        // First, clear any existing config for this page
        await R.exec("DELETE FROM dynamic_page_config WHERE status_page_id = ?", [ statusPageId ]);

        // Insert each tag
        for (const tag of tags) {
            if (!tag.tag_id) {
                continue;
            }

            const dynamicConfig = R.dispense("dynamic_page_config");
            dynamicConfig.status_page_id = statusPageId;
            dynamicConfig.tag_id = tag.tag_id;
            dynamicConfig.tag_name = tag.name || "";
            dynamicConfig.tag_color = tag.color || "#000000";
            dynamicConfig.tag_value = tag.value || "";
            await R.store(dynamicConfig);
        }
    }

    // Refresh dynamic status page monitors when viewed - FIXED WITH AND LOGIC
    /**
     * @param {string} statusPageId - status page ID
     * @returns {void}
     */
    async function refreshDynamicStatusPageMonitors(statusPageId) {
        try {
            // Get dynamic page configuration
            const dynamicConfigs = await R.find("dynamic_page_config", {
                status_page_id: statusPageId
            });

            if (!dynamicConfigs || dynamicConfigs.length === 0) {
                return 0; // Not a dynamic page
            }

            const tags = dynamicConfigs.map(config => ({
                tag_id: config.tag_id,
                name: config.tag_name,
                color: config.tag_color,
                value: config.tag_value
            }));

            const monitors = await getMonitorsByTags(tags);

            // Get or create the dynamic group for this status page
            let groupBean = await R.findOne("group", " status_page_id = ? AND name = ? ", [
                statusPageId,
                "Dynamic Monitors"
            ]);

            if (!groupBean) {
                groupBean = R.dispense("group");
                groupBean.status_page_id = statusPageId;
                groupBean.name = "Dynamic Monitors";
                groupBean.public = true;
                groupBean.weight = 1;
                await R.store(groupBean);
            }

            // Clear existing monitor-group relations for this group
            await R.exec("DELETE FROM monitor_group WHERE group_id = ?", [ groupBean.id ]);

            // Add matching monitors to the group
            let monitorOrder = 1;
            let addedCount = 0;

            for (const monitor of monitors) {
                let relationBean = R.dispense("monitor_group");
                relationBean.weight = monitorOrder++;
                relationBean.group_id = groupBean.id;
                relationBean.monitor_id = monitor.id;
                await R.store(relationBean);
                addedCount++;
            }

            return addedCount;

        } catch (error) {
            return 0;
        }
    }

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

    // Check if a monitor should be added to dynamic status pages
    socket.on("checkMonitorForDynamicPages", async (monitorId, monitorTags, callback) => {

        try {
            checkLogin(socket);

            // Get all dynamic status pages using Redbean
            const dynamicPages = await R.getAll(`
                SELECT DISTINCT status_page_id 
                FROM dynamic_page_config
            `);

            if (!dynamicPages || dynamicPages.length === 0) {
                callback({
                    ok: true,
                    addedToPages: []
                });
                return;
            }

            const addedToPages = [];

            for (const page of dynamicPages) {
                const statusPageId = page.status_page_id;

                const wasAdded = await checkAndAddToSingleDynamicPage(monitorId, monitorTags, statusPageId);

                if (wasAdded) {
                    addedToPages.push(statusPageId);
                }
            }

            callback({
                ok: true,
                addedToPages: addedToPages
            });

        } catch (error) {
            callback({
                ok: false,
                msg: error.message
            });
        }
    });

    // Helper function to check and add to a single dynamic page
    /**
     * @param {string} monitorId - monitor ID
     * @param {Array} monitorTags - monitor tags
     * @param {string} statusPageId - status page ID
     * @returns {boolean} - bool
     */
    async function checkAndAddToSingleDynamicPage(monitorId, monitorTags, statusPageId) {
        try {
            // Get the dynamic page configuration using Redbean
            const dynamicConfigs = await R.find("dynamic_page_config", " status_page_id = ? ", [ statusPageId ]);

            if (!dynamicConfigs || dynamicConfigs.length === 0) {
                return false;
            }

            // Convert to tags format
            const requiredTags = dynamicConfigs.map(config => ({
                tag_id: config.tag_id,
                name: config.tag_name,
                color: config.tag_color,
                value: config.tag_value
            }));

            // Check if monitor matches ALL required tags
            const matches = await monitorMatchesTags(monitorId, monitorTags, requiredTags);

            if (matches) {
                const success = await addMonitorToDynamicPageGroup(monitorId, statusPageId);
                return success;
            }

            return false;

        } catch (error) {
            return false;
        }
    }

    /**
     * Helper function to check if monitor matches required tags
     * @param {string} monitorId - monitor ID
     * @param {Array} monitorTags - monitor tags
     * @param {Array} requiredTags - required tags
     * @returns {boolean} - bool
     */
    async function monitorMatchesTags(monitorId, monitorTags, requiredTags) {
        try {
            // If no required tags, nothing matches
            if (!requiredTags || requiredTags.length === 0) {
                return false;
            }

            // If monitor has no tags, it can't match
            if (!monitorTags || monitorTags.length === 0) {
                return false;
            }

            // Convert monitor tags to a map for easier lookup
            const monitorTagMap = new Map();
            for (const monitorTag of monitorTags) {
                const tagId = String(monitorTag.id || monitorTag.tag_id);
                const value = String(monitorTag.value || "");
                monitorTagMap.set(`${tagId}-${value}`, monitorTag);
            }

            // Check if monitor has ANY of the required tags (OR logic)
            for (const requiredTag of requiredTags) {

                const requiredTagId = String(requiredTag.tag_id);
                const requiredValue = requiredTag.value ? String(requiredTag.value) : "";

                // Check if monitor has this exact tag (tag_id + value combination)
                const lookupKey1 = `${requiredTagId}-${requiredValue}`;

                if (monitorTagMap.has(lookupKey1)) {
                    return true; // Found at least one match - OR logic
                } else if (!requiredValue) {
                    // If no value is required, check if monitor has this tag with any value
                    for (const [ key ] of monitorTagMap.entries()) {
                        if (key.startsWith(`${requiredTagId}-`)) {
                            return true; // Found at least one match - OR logic
                        }
                    }
                }
            }

            // No required tags found
            return false;

        } catch (error) {
            return false;
        }
    }

    /**
     * Helper function to add monitor to dynamic page group
     * @param {string} monitorId - monitor ID
     * @param {string} statusPageId - status page ID
     * @returns {boolean} - bool if returned error
     */
    async function addMonitorToDynamicPageGroup(monitorId, statusPageId) {
        try {
            // Get or create the dynamic group for this status page using Redbean
            let groupBean = await R.findOne("group", " status_page_id = ? AND name = ? ", [
                statusPageId,
                "Dynamic Monitors"
            ]);

            if (!groupBean) {
                groupBean = R.dispense("group");
                groupBean.status_page_id = statusPageId;
                groupBean.name = "Dynamic Monitors";
                groupBean.public = true;
                groupBean.weight = 1;
                await R.store(groupBean);
            }

            // Check if monitor is already in the group using Redbean
            const existing = await R.findOne("monitor_group", " group_id = ? AND monitor_id = ? ", [
                groupBean.id,
                monitorId
            ]);

            if (!existing) {
                // Get the next weight using Redbean
                const maxWeightResult = await R.getRow(`
                    SELECT MAX(weight) as max_weight FROM monitor_group WHERE group_id = ?
                `, [ groupBean.id ]);

                const nextWeight = (maxWeightResult.max_weight || 0) + 1;

                // Add monitor to group using Redbean
                let relationBean = R.dispense("monitor_group");
                relationBean.weight = nextWeight;
                relationBean.group_id = groupBean.id;
                relationBean.monitor_id = monitorId;
                await R.store(relationBean);

                return true;
            } else {
                return false;
            }

        } catch (error) {
            return false;
        }
    }

    // Server-side socket event handler for getting dynamic page config
    socket.on("getDynamicPageConfig", async (slug, callback) => {
        try {

            // First get the status page ID from the slug
            const statusPage = await R.findOne("status_page", "slug = ?", [ slug ]);

            if (!statusPage) {
                return callback({
                    ok: false,
                    msg: "Status page not found"
                });
            }

            // Read dynamic page config from database
            const dynamicConfigs = await R.find("dynamic_page_config", "status_page_id = ?", [ statusPage.id ]);

            if (dynamicConfigs && dynamicConfigs.length > 0) {
                // Convert to tag format expected by frontend
                const tags = dynamicConfigs.map(config => ({
                    tag_id: config.tag_id,
                    id: config.tag_id, // For compatibility with tags-manager
                    name: config.tag_name,
                    color: config.tag_color,
                    value: config.tag_value,
                    // Add other required properties for tags-manager
                    monitor_id: null,
                    new: false
                }));

                callback({
                    ok: true,
                    tags: tags
                });
            } else {
                // No dynamic config found
                callback({
                    ok: true,
                    tags: []
                });
            }
        } catch (error) {
            callback({
                ok: false,
                msg: "Failed to load dynamic page configuration: " + error.message
            });
        }
    });

    socket.on("saveDynamicPageConfig", async (slug, tags, callback) => {
        try {

            // First get the status page ID from the slug
            const statusPage = await R.findOne("status_page", "slug = ?", [ slug ]);

            if (!statusPage) {
                return callback({
                    ok: false,
                    msg: "Status page not found"
                });
            }

            // Clear existing config
            await R.exec("DELETE FROM dynamic_page_config WHERE status_page_id = ?", [ statusPage.id ]);

            // Save new tags
            for (const tag of tags) {
                if (!tag.tag_id) {
                    continue;
                }

                const dynamicConfig = R.dispense("dynamic_page_config");
                dynamicConfig.status_page_id = statusPage.id;
                dynamicConfig.tag_id = tag.tag_id;
                dynamicConfig.tag_name = tag.name || "";
                dynamicConfig.tag_color = tag.color || "#000000";
                dynamicConfig.tag_value = tag.value || "";
                await R.store(dynamicConfig);
            }

            // Now update the monitors based on these tags
            await updateDynamicPageMonitors(statusPage.id, tags);

            // Clear cache to ensure fresh data
            apicache.clear();

            callback({
                ok: true,
                message: `Updated dynamic page with ${tags.length} tags`
            });

        } catch (error) {
            console.error("Error saving dynamic page config:", error);
            callback({
                ok: false,
                msg: "Failed to save dynamic page configuration: " + error.message
            });
        }
    });

    /**
     * Simple function to update dynamic page monitors based on tags
     * @param {string} statusPageId - status page ID
     * @param {Array} tags - tags array
     * @returns {void}
     */
    async function updateDynamicPageMonitors(statusPageId, tags) {
        // Get or create dynamic group
        let groupBean = await R.findOne("group", " status_page_id = ? AND name = ? ", [
            statusPageId,
            "Dynamic Monitors"
        ]);

        if (!groupBean) {
            groupBean = R.dispense("group");
            groupBean.status_page_id = statusPageId;
            groupBean.name = "Dynamic Monitors";
            groupBean.public = true;
            groupBean.weight = 1;
            await R.store(groupBean);
        }

        // Clear existing monitors from group
        await R.exec("DELETE FROM monitor_group WHERE group_id = ?", [ groupBean.id ]);

        // If no tags, we're done
        if (!tags || tags.length === 0) {
            return;
        }

        const monitors = await getMonitorsByTags(tags);

        // Add matching monitors to group
        let monitorOrder = 1;
        for (const monitor of monitors) {
            let relationBean = R.dispense("monitor_group");
            relationBean.weight = monitorOrder++;
            relationBean.group_id = groupBean.id;
            relationBean.monitor_id = monitor.id;
            await R.store(relationBean);
        }
    }

    // Also update the getStatusPage handler to refresh dynamic pages
    socket.on("getStatusPage", async (slug, callback) => {
        try {
            checkLogin(socket);

            let statusPage = await R.findOne("status_page", " slug = ? ", [
                slug
            ]);

            if (!statusPage) {
                throw new Error("No slug?");
            }

            // Check if this is a dynamic page and refresh monitors
            const dynamicConfigs = await R.find("dynamic_page_config", {
                status_page_id: statusPage.id
            });

            if (dynamicConfigs && dynamicConfigs.length > 0) {
                // This is a dynamic page, refresh monitors
                await refreshDynamicStatusPageMonitors(statusPage.id);
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

    socket.on("clearDynamicPageConfig", async (slug, callback) => {
        try {
            // First get the status page ID from the slug
            const statusPage = await R.findOne("status_page", "slug = ?", [ slug ]);

            if (!statusPage) {
                return callback({
                    ok: false,
                    msg: "Status page not found"
                });
            }

            // Clear dynamic page config
            await R.exec("DELETE FROM dynamic_page_config WHERE status_page_id = ?", [ statusPage.id ]);

            callback({
                ok: true
            });
        } catch (error) {
            callback({
                ok: false,
                msg: "Failed to clear dynamic page configuration"
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
