/**
 * Represents a variable used in a condition and the set of operators that can be applied to this variable.
 *
 * A `ConditionVariable` holds the ID of the variable and a list of operators that define how this variable can be evaluated
 * in conditions. For example, if the variable is a request body or a specific field in a request, the operators can include
 * operations such as equality checks, comparisons, or other custom evaluations.
 */
class ConditionVariable {
    /**
     * @type {string}
     */
    id;

    /**
     * @type {import("./operators").ConditionOperator[]}
     */
    operators = {};

    /**
     * @param {string} id ID of variable
     * @param {import("./operators").ConditionOperator[]} operators Operators the condition supports
     */
    constructor(id, operators = []) {
        this.id = id;
        this.operators = operators;
    }
}

module.exports = {
    ConditionVariable,
};
