const { MonitorType } = require("./monitor-type");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators, defaultNumberOperators } = require("../monitor-conditions/operators");

class JsonQueryMonitorType extends MonitorType {
    name = "json-query";

    supportsConditions = true;

    conditionVariables = [new ConditionVariable("value", [...defaultStringOperators, ...defaultNumberOperators])];
}

module.exports = {
    JsonQueryMonitorType,
};
