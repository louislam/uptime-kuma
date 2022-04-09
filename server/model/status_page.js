const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");

class StatusPage extends BeanModel {

    static domainMappingList = { };

    /**
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

    static async sendStatusPageList(io, socket) {
        let result = {};

        let list = await R.findAll("status_page", " ORDER BY title ");

        for (let item of list) {
            result[item.id] = await item.toJSON();
        }

        io.to(socket.userID).emit("statusPageList", result);
        return list;
    }

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
        };
    }

    async toPublicJSON() {
        return {
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.getIcon(),
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
        };
    }

    static async slugToID(slug) {
        return await R.getCell("SELECT id FROM status_page WHERE slug = ? ", [
            slug
        ]);
    }

    getIcon() {
        if (!this.icon) {
            return "/icon.svg";
        } else {
            return this.icon;
        }
    }

}

module.exports = StatusPage;
