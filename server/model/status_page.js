const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const cheerio = require("cheerio");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { log } = require("../../src/util");
const jsesc = require("jsesc");
const googleAnalytics = require("../google-analytics");
const ImageDataURI = require("../image-data-uri");
const Database = require("../database");
const { setSetting } = require("../util-server");

class StatusPage extends BeanModel {

    /**
     * Like this: { "test-uptime.kuma.pet": "default" }
     * @type {{}}
     */
    static domainMappingList = { };

    /**
     * Create new StatusPage
     * @param {string} title title of the status page
     * @param {string} slug slug of the satus page
     * @returns {Promise<Bean>} The created status page
     */
    static async create(title, slug) {
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

        StatusPage.checkSlug(slug);

        let statusPage = R.dispense("status_page");
        statusPage.slug = slug;
        statusPage.title = title;
        statusPage.theme = "auto";
        statusPage.icon = "";
        await R.store(statusPage);

        return statusPage;
    }

    /**
     * Saves and updates Status Page
     *
     * @param {string} slug slug of the status page to save to
     * @param {Object} config config of the status page
     * @param {string} imgDataUrl url of the logo
     * @param {Object[]} publicGroupList list of groups of monitors
     * @return {Promise<Bean>} the updated status page bean
     */
    static async save(slug, config, imgDataUrl, publicGroupList) {
        // Save Config
        let statusPage = await R.findOne("status_page", " slug = ? ", [
            slug
        ]);

        if (!statusPage) {
            throw new Error("No slug?");
        }

        StatusPage.checkSlug(config.slug);

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
        statusPage.footer_text = config.footerText;
        statusPage.custom_css = config.customCSS;
        statusPage.show_powered_by = config.showPoweredBy;
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

                await R.store(relationBean);
            }

            groupIDList.push(groupBean.id);
            group.id = groupBean.id;
        }

        // Delete groups that are not in the list
        log.debug("socket", "Delete groups that are not in the list");
        const slots = groupIDList.map(() => "?").join(",");

        const data = [
            ...groupIDList,
            statusPage.id
        ];
        await R.exec(`DELETE FROM \`group\` WHERE id NOT IN (${slots}) AND status_page_id = ?`, data);

        const server = UptimeKumaServer.getInstance();

        // Also change entry page to new slug if it is the default one, and slug is changed.
        if (server.entryPage === "statusPage-" + slug && statusPage.slug !== slug) {
            server.entryPage = "statusPage-" + statusPage.slug;
            await setSetting("entryPage", server.entryPage, "general");
        }

        return statusPage;
    }

    /**
     * Check slug a-z, 0-9, - only
     * Regex from: https://stackoverflow.com/questions/22454258/js-regex-string-validation-for-slug
     * @param {string} slug Slug to test
     * @throws if the slug is invalid
     */
    static checkSlug(slug) {
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

    /**
     *
     * @param {Response} response
     * @param {string} indexHTML
     * @param {string} slug
     */
    static async handleStatusPageResponse(response, indexHTML, slug) {
        let statusPage = await R.findOne("status_page", " slug = ? ", [
            slug
        ]);

        if (statusPage) {
            response.send(await StatusPage.renderHTML(indexHTML, statusPage));
        } else {
            response.status(404).send(UptimeKumaServer.getInstance().indexHTML);
        }
    }

    /**
     * SSR for status pages
     * @param {string} indexHTML
     * @param {StatusPage} statusPage
     */
    static async renderHTML(indexHTML, statusPage) {
        const $ = cheerio.load(indexHTML);
        const description155 = statusPage.description?.substring(0, 155) ?? "";

        $("title").text(statusPage.title);
        $("meta[name=description]").attr("content", description155);

        if (statusPage.icon) {
            $("link[rel=icon]")
                .attr("href", statusPage.icon)
                .removeAttr("type");

            $("link[rel=apple-touch-icon]").remove();
        }

        const head = $("head");

        if (statusPage.googleAnalyticsTagId) {
            let escapedGoogleAnalyticsScript = googleAnalytics.getGoogleAnalyticsScript(statusPage.googleAnalyticsTagId);
            head.append($(escapedGoogleAnalyticsScript));
        }

        // OG Meta Tags
        let ogTitle = $("<meta property=\"og:title\" content=\"\" />").attr("content", statusPage.title);
        head.append(ogTitle);

        let ogDescription = $("<meta property=\"og:description\" content=\"\" />").attr("content", description155);
        head.append(ogDescription);

        // Preload data
        // Add jsesc, fix https://github.com/louislam/uptime-kuma/issues/2186
        const escapedJSONObject = jsesc(await StatusPage.getStatusPageData(statusPage), {
            "isScriptContext": true
        });

        const script = $(`
            <script id="preload-data" data-json="{}">
                window.preloadData = ${escapedJSONObject};
            </script>
        `);

        head.append(script);

        // manifest.json
        $("link[rel=manifest]").attr("href", `/api/status-page/${statusPage.slug}/manifest.json`);

        return $.root().html();
    }

    /**
     * Get all status page data in one call
     * @param {StatusPage} statusPage
     */
    static async getStatusPageData(statusPage) {
        // Incident
        let incident = await R.findOne("incident", " pin = 1 AND active = 1 AND status_page_id = ? ", [
            statusPage.id,
        ]);

        if (incident) {
            incident = incident.toPublicJSON();
        }

        let maintenanceList = await StatusPage.getMaintenanceList(statusPage.id);

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
        return {
            config: await statusPage.toPublicJSON(),
            incident,
            publicGroupList,
            maintenanceList,
        };
    }

    /**
     * Produce full data of status page for backup
     * @param {StatusPage} statusPage
     */
    static async getStatusPageBackup(statusPage) {
        // Incidents
        let incidents = await Promise.all((await R.find("incident", "status_page_id = ?", [
            statusPage.id,
        ])).map(async (incident) => await incident.toPublicJSON()));

        // Maintenance
        let maintenanceList = await StatusPage.getMaintenanceList(statusPage.id);

        // Monitors
        const groupList = await Promise.all((await R.find("group", "status_page_id = ? ORDER BY weight ", [
            statusPage.id
        ])).map(async (group) => {
            return await group.toPublicJSON(false);
        }));

        // Response
        return {
            config: await statusPage.toJSON(),
            incidents,
            groupList,
            maintenanceList,
        };
    }

    /**
     * Loads domain mapping from DB
     * Return object like this: { "test-uptime.kuma.pet": "default" }
     * @returns {Promise<void>}
     */
    static async loadDomainMappingList() {
        StatusPage.domainMappingList = await R.getAssoc(`
            SELECT domain, slug
            FROM status_page, status_page_cname
            WHERE status_page.id = status_page_cname.status_page_id
        `);
    }

    /**
     * Get status page list
     * @returns {Promise<Bean[]>} list of status page objects
     */
    static async getStatusPageList() {
        return await R.findAll("status_page", " ORDER BY title ");
    }

    /**
     * Send status page list to client
     * @param {Server} io io Socket server instance
     * @param {Socket} socket Socket.io instance
     * @returns {Promise<Bean[]>}
     */
    static async sendStatusPageList(io, socket) {
        log.debug("status_page", `Sending status page list to user: ${socket.userID}`);

        let result = {};

        let list = await R.findAll("status_page", " ORDER BY title ");

        for (let item of list) {
            result[item.id] = await item.toJSON();
        }

        io.to(socket.userID).emit("statusPageList", result);
    }

    /**
     * Update list of domain names
     * @param {string[]} domainNameList
     * @returns {Promise<void>}
     */
    async updateDomainNameList(domainNameList) {

        if (!Array.isArray(domainNameList)) {
            throw new Error("Invalid array");
        }

        let trx = await R.begin();

        await trx.exec("DELETE FROM status_page_cname WHERE status_page_id = ?", [
            this.id,
        ]);

        try {
            for (let domain of domainNameList) {
                if (typeof domain !== "string") {
                    throw new Error("Invalid domain");
                }

                if (domain.trim() === "") {
                    continue;
                }

                // If the domain name is used in another status page, delete it
                await trx.exec("DELETE FROM status_page_cname WHERE domain = ?", [
                    domain,
                ]);

                let mapping = trx.dispense("status_page_cname");
                mapping.status_page_id = this.id;
                mapping.domain = domain;
                await trx.store(mapping);
            }
            await trx.commit();
        } catch (error) {
            await trx.rollback();
            throw error;
        }
    }

    /**
     * Get list of domain names
     * @returns {Object[]}
     */
    getDomainNameList() {
        let domainList = [];
        for (let domain in StatusPage.domainMappingList) {
            let s = StatusPage.domainMappingList[domain];

            if (this.slug === s) {
                domainList.push(domain);
            }
        }
        return domainList;
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    async toJSON() {
        return {
            id: this.id,
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.getIcon(),
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
            domainNameList: this.getDomainNameList(),
            customCSS: this.custom_css,
            footerText: this.footer_text,
            showPoweredBy: !!this.show_powered_by,
            googleAnalyticsId: this.google_analytics_tag_id,
        };
    }

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON() {
        return {
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.getIcon(),
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
            customCSS: this.custom_css,
            footerText: this.footer_text,
            showPoweredBy: !!this.show_powered_by,
            googleAnalyticsId: this.google_analytics_tag_id,
        };
    }

    /**
     * Convert slug to status page ID
     * @param {string} slug
     */
    static async slugToID(slug) {
        return await R.getCell("SELECT id FROM status_page WHERE slug = ? ", [
            slug
        ]);
    }

    /**
     * Get path to the icon for the page
     * @returns {string}
     */
    getIcon() {
        if (!this.icon) {
            return "/icon.svg";
        } else {
            return this.icon;
        }
    }

    /**
     * Get list of maintenances
     * @param {number} statusPageId ID of status page to get maintenance for
     * @returns {Object} Object representing maintenances sanitized for public
     */
    static async getMaintenanceList(statusPageId) {
        try {
            const publicMaintenanceList = [];

            let maintenanceIDList = await R.getCol(`
                SELECT DISTINCT maintenance_id
                FROM maintenance_status_page
                WHERE status_page_id = ?
            `, [ statusPageId ]);

            for (const maintenanceID of maintenanceIDList) {
                let maintenance = UptimeKumaServer.getInstance().getMaintenance(maintenanceID);
                if (maintenance && await maintenance.isUnderMaintenance()) {
                    publicMaintenanceList.push(await maintenance.toPublicJSON());
                }
            }

            return publicMaintenanceList;

        } catch (error) {
            return [];
        }
    }
}

module.exports = StatusPage;
