const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const StatusPage = require("./status_page");
const dayjs = require("dayjs");

class Incident extends BeanModel {

    /**
     * Saves and updates Incident
     *
     * @param {string} slug slug of the status page to save to
     * @param {Object} incident JSON of the incident data
     * @return {Promise<Bean>} the updated incident bean
     */
    static async save(slug, incident) {

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

        return incidentBean;
    }

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    toPublicJSON() {
        return {
            id: this.id,
            style: this.style,
            title: this.title,
            content: this.content,
            pin: this.pin,
            createdDate: this.createdDate,
            lastUpdatedDate: this.lastUpdatedDate,
        };
    }
}

module.exports = Incident;
