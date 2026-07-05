const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { canReach } = require("../../src/dependency-graph-utils");

class MonitorDependency extends BeanModel {
    /**
     * Returns an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            monitorID: this.monitor_id,
            dependsOnMonitorID: this.depends_on_monitor_id,
            relationType: this.relation_type,
            createdDate: this.created_date,
        };
    }

    /**
     * Checks whether adding an edge "monitorID depends on dependsOnMonitorID" would
     * create a cycle in the dependency graph, by checking if dependsOnMonitorID can
     * already (transitively) reach monitorID through existing dependency edges.
     * Uses the same canReach() traversal as the client-side graph editor.
     * @param {number} monitorID ID of the monitor that would gain the new dependency
     * @param {number} dependsOnMonitorID ID of the monitor being depended on
     * @returns {Promise<boolean>} True if the edge would create a cycle
     */
    static async wouldCreateCycle(monitorID, dependsOnMonitorID) {
        if (monitorID === dependsOnMonitorID) {
            return true;
        }

        const rows = await R.getAll("SELECT monitor_id, depends_on_monitor_id FROM monitor_dependency");
        const edges = rows.map((row) => ({
            monitorID: row.monitor_id,
            dependsOnMonitorID: row.depends_on_monitor_id,
        }));

        return canReach(edges, dependsOnMonitorID, monitorID);
    }
}

module.exports = MonitorDependency;
