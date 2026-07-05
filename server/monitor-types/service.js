const { GroupMonitorType } = require("./group");

/**
 * A "service" is a business-facing grouping of monitors (e.g. checkout flow, auth,
 * search) that share the same worst-of status aggregation as a "group" monitor,
 * but are displayed as a dependency tree (via monitor_dependency) instead of a
 * plain member list, to make root-cause analysis obvious.
 */
class ServiceMonitorType extends GroupMonitorType {
    name = "service";
}

module.exports = {
    ServiceMonitorType,
};
