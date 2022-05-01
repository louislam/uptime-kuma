const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");

class Group extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @param {boolean} [showTags=false] Should the JSON include monitor tags
     * @returns {Object}
     */
    async toPublicJSON(showTags = false) {
        let monitorBeanList = await this.getMonitorList();
        let monitorList = [];

        for (let bean of monitorBeanList) {
            monitorList.push(await bean.toPublicJSON(showTags));
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
     * @returns {Bean[]}
     */
    async getMonitorList() {
        return R.convertToBeans("monitor", await R.getAll(`
            SELECT monitor.* FROM monitor, monitor_group
            WHERE monitor.id = monitor_group.monitor_id
            AND group_id = ?
            ORDER BY monitor_group.weight
        `, [
            this.id,
        ]));
    }
}

module.exports = Group;
