const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");

class Group extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public Only show
     * necessary data to public
     * @param {boolean} showTags Should the JSON include monitor tags
     * @param {boolean} certExpiry Should JSON include info about
     * certificate expiry?
     * @param {boolean} prioritizeFailedMonitors Should failed monitors be prioritized?
     * @returns {Promise<object>} Object ready to parse
     */
    async toPublicJSON(showTags = false, certExpiry = false, prioritizeFailedMonitors = false) {
        let monitorBeanList = await this.getMonitorList(prioritizeFailedMonitors);
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
     * @param {boolean} prioritizeFailedMonitors Should failed monitors be prioritized?
     * @returns {Promise<Bean[]>} List of monitors
     */
    async getMonitorList(prioritizeFailedMonitors = false) {
        if (prioritizeFailedMonitors) {
            return R.convertToBeans("monitor", await R.getAll(`
                SELECT
                    monitor.*,
                    monitor_group.send_url,
                    monitor_group.custom_url,
                    monitor_group.weight,
                    heartbeat.status as current_status,
                    heartbeat.time as last_check
                FROM monitor
                JOIN monitor_group ON monitor.id = monitor_group.monitor_id
                LEFT JOIN heartbeat ON monitor.id = heartbeat.monitor_id
                    AND heartbeat.time = (
                        SELECT MAX(time) FROM heartbeat h2
                        WHERE h2.monitor_id = monitor.id
                    )
                WHERE monitor_group.group_id = ?
                ORDER BY
                    CASE heartbeat.status
                        WHEN 0 THEN 0  -- DOWN first
                        WHEN 2 THEN 1  -- PENDING second
                        WHEN 1 THEN 2  -- UP last
                        ELSE 3         -- NULL/unknown last
                    END,
                    monitor_group.weight ASC
            `, [
                this.id,
            ]));
        } else {
            return R.convertToBeans("monitor", await R.getAll(`
                SELECT monitor.*, monitor_group.send_url, monitor_group.custom_url FROM monitor, monitor_group
                WHERE monitor.id = monitor_group.monitor_id
                AND group_id = ?
                ORDER BY monitor_group.weight
            `, [
                this.id,
            ]));
        }
    }
}

module.exports = Group;
