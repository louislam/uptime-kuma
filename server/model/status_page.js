const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const cheerio = require("cheerio");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const jsesc = require("jsesc");
const googleAnalytics = require("../google-analytics");
const { marked } = require("marked");
const { Feed } = require("feed");
const config = require("../config");

const { STATUS_PAGE_ALL_DOWN, STATUS_PAGE_ALL_UP, STATUS_PAGE_MAINTENANCE, STATUS_PAGE_PARTIAL_DOWN, UP, MAINTENANCE, DOWN } = require("../../src/util");

class StatusPage extends BeanModel {

    /**
     * Like this: { "test-uptime.kuma.pet": "default" }
     * @type {{}}
     */
    static domainMappingList = { };

    /**
     * Handle responses to RSS pages
     * @param {Response} response Response object
     * @param {string} slug Status page slug
     * @returns {Promise<void>}
     */
    static async handleStatusPageRSSResponse(response, slug) {
        let statusPage = await R.findOne("status_page", " slug = ? ", [
            slug
        ]);

        if (statusPage) {
            response.send(await StatusPage.renderRSS(statusPage, slug));
        } else {
            response.status(404).send(UptimeKumaServer.getInstance().indexHTML);
        }
    }

    /**
     * Handle responses to status page
     * @param {Response} response Response object
     * @param {string} indexHTML HTML to render
     * @param {string} slug Status page slug
     * @returns {Promise<void>}
     */
    static async handleStatusPageResponse(response, indexHTML, slug) {
        // Handle url with trailing slash (http://localhost:3001/status/)
        // The slug comes from the route "/status/:slug". If the slug is empty, express converts it to "index.html"
        if (slug === "index.html") {
            slug = "default";
        }

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
     * SSR for RSS feed
     * @param {statusPage} statusPage object
     * @param {slug} slug from router
     * @returns {Promise<string>} the rendered html
     */
    static async renderRSS(statusPage, slug) {
        const { heartbeats, statusDescription } = await StatusPage.getRSSPageData(statusPage);

        let proto = config.isSSL ? "https" : "http";
        let host = `${proto}://${config.hostname || "localhost"}:${config.port}/status/${slug}`;

        const feed = new Feed({
            title: "uptime kuma rss feed",
            description: `current status: ${statusDescription}`,
            link: host,
            language: "en", // optional, used only in RSS 2.0, possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
            updated: new Date(), // optional, default = today
        });

        heartbeats.forEach(heartbeat => {
            feed.addItem({
                title: `${heartbeat.name} is down`,
                description: `${heartbeat.name} has been down since ${heartbeat.time}`,
                id: heartbeat.monitorID,
                date: new Date(heartbeat.time),
            });
        });

        return feed.rss2();
    }

    /**
     * SSR for status pages
     * @param {string} indexHTML HTML page to render
     * @param {StatusPage} statusPage Status page populate HTML with
     * @returns {Promise<string>} the rendered html
     */
    static async renderHTML(indexHTML, statusPage) {
        const $ = cheerio.load(indexHTML);

        const description155 = marked(statusPage.description ?? "")
            .replace(/<[^>]+>/gm, "")
            .trim()
            .substring(0, 155);

        $("title").text(statusPage.title);
        $("meta[name=description]").attr("content", description155);

        if (statusPage.icon) {
            $("link[rel=icon]")
                .attr("href", statusPage.icon)
                .removeAttr("type");

            $("link[rel=apple-touch-icon]").remove();
        }

        const head = $("head");

        if (statusPage.google_analytics_tag_id) {
            let escapedGoogleAnalyticsScript = googleAnalytics.getGoogleAnalyticsScript(statusPage.google_analytics_tag_id);
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
     * @param {heartbeats} heartbeats from getRSSPageData
     * @returns {number} status_page constant from util.ts
     */
    static overallStatus(heartbeats) {
        if (heartbeats.length === 0) {
            return -1;
        }

        let status = STATUS_PAGE_ALL_UP;
        let hasUp = false;

        for (let beat of heartbeats) {
            if (beat.status === MAINTENANCE) {
                return STATUS_PAGE_MAINTENANCE;
            } else if (beat.status === UP) {
                hasUp = true;
            } else {
                status = STATUS_PAGE_PARTIAL_DOWN;
            }
        }

        if (! hasUp) {
            status = STATUS_PAGE_ALL_DOWN;
        }

        return status;
    }

    /**
     * @param {number} status from overallStatus
     * @returns {string} description
     */
    static getStatusDescription(status) {
        if (status === -1) {
            return "No Services";
        }

        if (status === STATUS_PAGE_ALL_UP) {
            return "All Systems Operational";
        }

        if (status === STATUS_PAGE_PARTIAL_DOWN) {
            return "Partially Degraded Service";
        }

        if (status === STATUS_PAGE_ALL_DOWN) {
            return "Degraded Service";
        }

        // TODO: show the real maintenance information: title, description, time
        if (status === MAINTENANCE) {
            return "Under maintenance";
        }

        return "?";
    }

    /**
     * Get all data required for RSS
     * @param {StatusPage} statusPage Status page to get data for
     * @returns {object} Status page data
     */
    static async getRSSPageData(statusPage) {
        // get all heartbeats that correspond to this statusPage
        const config = await statusPage.toPublicJSON();

        // Public Group List
        const showTags = !!statusPage.show_tags;

        const list = await R.find("group", " public = 1 AND status_page_id = ? ORDER BY weight ", [
            statusPage.id
        ]);

        let heartbeats = [];

        for (let groupBean of list) {
            let monitorGroup = await groupBean.toPublicJSON(showTags, config?.showCertificateExpiry);
            for (const monitor of monitorGroup.monitorList) {
                const heartbeat = await R.findOne("heartbeat", "monitor_id = ? ORDER BY time DESC", [ monitor.id ]);
                if (heartbeat) {
                    heartbeats.push({
                        ...monitor,
                        status: heartbeat.status,
                        time: heartbeat.time
                    });
                }
            }
        }

        // calculate RSS feed description
        let status = StatusPage.overallStatus(heartbeats);
        let statusDescription = StatusPage.getStatusDescription(status);

        // keep only DOWN heartbeats in the RSS feed
        heartbeats = heartbeats.filter(heartbeat => heartbeat.status === DOWN);

        return {
            heartbeats,
            statusDescription
        };
    }

    /**
     * Get all status page data in one call
     * @param {StatusPage} statusPage Status page to get data for
     * @returns {object} Status page data
     */
    static async getStatusPageData(statusPage) {
        const config = await statusPage.toPublicJSON();

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
            let monitorGroup = await groupBean.toPublicJSON(showTags, config?.showCertificateExpiry);
            publicGroupList.push(monitorGroup);
        }

        // Response
        return {
            config,
            incident,
            publicGroupList,
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
     * Send status page list to client
     * @param {Server} io io Socket server instance
     * @param {Socket} socket Socket.io instance
     * @returns {Promise<Bean[]>} Status page list
     */
    static async sendStatusPageList(io, socket) {
        let result = {};

        let list = await R.findAll("status_page", " ORDER BY title ");

        for (let item of list) {
            result[item.id] = await item.toJSON();
        }

        io.to(socket.userID).emit("statusPageList", result);
        return list;
    }

    /**
     * Update list of domain names
     * @param {string[]} domainNameList List of status page domains
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
     * @returns {object[]} List of status page domains
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
     * @returns {object} Object ready to parse
     */
    async toJSON() {
        return {
            id: this.id,
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.getIcon(),
            theme: this.theme,
            autoRefreshInterval: this.autoRefreshInterval,
            published: !!this.published,
            showTags: !!this.show_tags,
            domainNameList: this.getDomainNameList(),
            customCSS: this.custom_css,
            footerText: this.footer_text,
            showPoweredBy: !!this.show_powered_by,
            googleAnalyticsId: this.google_analytics_tag_id,
            showCertificateExpiry: !!this.show_certificate_expiry,
        };
    }

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {object} Object ready to parse
     */
    async toPublicJSON() {
        return {
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.getIcon(),
            autoRefreshInterval: this.autoRefreshInterval,
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
            customCSS: this.custom_css,
            footerText: this.footer_text,
            showPoweredBy: !!this.show_powered_by,
            googleAnalyticsId: this.google_analytics_tag_id,
            showCertificateExpiry: !!this.show_certificate_expiry,
        };
    }

    /**
     * Convert slug to status page ID
     * @param {string} slug Status page slug
     * @returns {Promise<number>} ID of status page
     */
    static async slugToID(slug) {
        return await R.getCell("SELECT id FROM status_page WHERE slug = ? ", [
            slug
        ]);
    }

    /**
     * Get path to the icon for the page
     * @returns {string} Path
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
     * @returns {object} Object representing maintenances sanitized for public
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
