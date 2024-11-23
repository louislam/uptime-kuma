const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");

class Group extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @param {boolean} showTags Should the JSON include monitor tags
     * @param {boolean} certExpiry Should JSON include info about
     * certificate expiry?
     * @param {boolean} showStatus Should the JSON include the status
     * @returns {Promise<object>} Object ready to parse
     */
    async toPublicJSON(showTags = false, certExpiry = false, showStatus = false) {
        let monitorBeanList = await this.getMonitorList();
        let monitorList = [];

        for (let bean of monitorBeanList) {
            monitorList.push(await bean.toPublicJSON(showTags, certExpiry, showStatus));
        }

        return {
            id: this.id,
            name: this.name,
            weight: this.weight,
            monitorList,
        };
    }

    /**
     * Get all monitors
     * @returns {Promise<Bean[]>} List of monitors
     */
    async getMonitorList() {
        return R.convertToBeans("monitor", await R.getAll(`
            SELECT monitor.*, monitor_group.send_url FROM monitor, monitor_group
            WHERE monitor.id = monitor_group.monitor_id
            AND group_id = ?
            ORDER BY monitor_group.weight
        `, [
            this.id,
        ]));
    }
}

module.exports = Group;
