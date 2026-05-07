const { BaseModel } = require("./base-model");

class Group extends BaseModel {
    static tableName = "group";

    /**
     * Return an object that ready to parse to JSON for public Only show
     * necessary data to public
     * @param {boolean} showTags Should the JSON include monitor tags
     * @param {boolean} certExpiry Should JSON include info about
     * certificate expiry?
     * @returns {Promise<object>} Object ready to parse
     */
    async toPublicJSON(showTags = false, certExpiry = false) {
        let monitorBeanList = await this.getMonitorList();
        let monitorList = [];

        for (let bean of monitorBeanList) {
            monitorList.push(await bean.toPublicJSON(showTags, certExpiry));
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
     * @returns {Promise<import("./monitor")[]>} List of monitors
     */
    async getMonitorList() {
        const Monitor = require("./monitor");
        return Monitor.query()
            .innerJoin("monitor_group", "monitor.id", "monitor_group.monitor_id")
            .where("monitor_group.group_id", this.id)
            .orderBy("monitor_group.weight")
            .select("monitor.*", "monitor_group.send_url", "monitor_group.custom_url");
    }
}

module.exports = Group;
