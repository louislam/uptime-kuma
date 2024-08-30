/**
 * @readonly
 * @enum {string}
 */
const LOGICAL = {
    AND: "and",
    OR: "or",
};

/**
 * Recursively processes an array of raw condition objects and populates the given parent group with
 * corresponding ConditionExpression or ConditionExpressionGroup instances.
 * @param {Array} conditions Array of raw condition objects, where each object represents either a group or an expression.
 * @param {ConditionExpressionGroup} parentGroup The parent group to which the instantiated ConditionExpression or ConditionExpressionGroup objects will be added.
 * @returns {void}
 */
function processMonitorConditions(conditions, parentGroup) {
    conditions.forEach(condition => {
        const andOr = condition.andOr === LOGICAL.OR ? LOGICAL.OR : LOGICAL.AND;

        if (condition.type === "group") {
            const group = new ConditionExpressionGroup([], andOr);

            // Recursively process the group's children
            processMonitorConditions(condition.children, group);

            parentGroup.children.push(group);
        } else if (condition.type === "expression") {
            const expression = new ConditionExpression(condition.variable, condition.operator, condition.value, andOr);
            parentGroup.children.push(expression);
        }
    });
}

class ConditionExpressionGroup {
    /**
     * @type {ConditionExpressionGroup[]|ConditionExpression[]} Groups and/or expressions to test
     */
    children = [];

    /**
     * @type {LOGICAL} Connects group result with previous group/expression results
     */
    andOr;

    /**
     * @param {ConditionExpressionGroup[]|ConditionExpression[]} children Groups and/or expressions to test
     * @param {LOGICAL} andOr Connects group result with previous group/expression results
     */
    constructor(children = [], andOr = LOGICAL.AND) {
        this.children = children;
        this.andOr = andOr;
    }

    /**
     * @param {Monitor} monitor Monitor instance
     * @returns {ConditionExpressionGroup|null} A ConditionExpressionGroup with the Monitor's conditions
     */
    static fromMonitor(monitor) {
        const conditions = JSON.parse(monitor.conditions);
        if (conditions.length === 0) {
            return null;
        }

        const root = new ConditionExpressionGroup();
        processMonitorConditions(conditions, root);

        return root;
    }
}

class ConditionExpression {
    /**
     * @type {string} ID of variable
     */
    variable;

    /**
     * @type {string} ID of operator
     */
    operator;

    /**
     * @type {string} Value to test with the operator
     */
    value;

    /**
     * @type {LOGICAL} Connects expression result with previous group/expression results
     */
    andOr;

    /**
     * @param {string} variable ID of variable to test against
     * @param {string} operator ID of operator to test the variable with
     * @param {string} value Value to test with the operator
     * @param {LOGICAL} andOr Connects expression result with previous group/expression results
     */
    constructor(variable, operator, value, andOr = LOGICAL.AND) {
        this.variable = variable;
        this.operator = operator;
        this.value = value;
        this.andOr = andOr;
    }
}

module.exports = {
    LOGICAL,
    ConditionExpressionGroup,
    ConditionExpression,
};
