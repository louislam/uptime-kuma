const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const dayjs = require("dayjs");

class Incident extends BeanModel {

    /**
     * Resolve the incident and mark it as inactive
     * @returns {Promise<void>}
     */
    async resolve() {
        this.active = false;
        this.pin = false;
        this.lastUpdatedDate = R.isoDateTime(dayjs.utc());
        await R.store(this);
    }

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {object} Object ready to parse
     */
    toPublicJSON() {
        return {
            id: this.id,
            style: this.style,
            title: this.title,
            content: this.content,
            pin: !!this.pin,
            active: !!this.active,
            createdDate: this.createdDate,
            lastUpdatedDate: this.lastUpdatedDate,
        };
    }

    /**
     * Return full object for admin use
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            ...this.toPublicJSON(),
            status_page_id: this.status_page_id,
        };
    }
}

module.exports = Incident;
