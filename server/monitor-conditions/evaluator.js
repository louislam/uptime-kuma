const { ConditionExpressionGroup, ConditionExpression, LOGICAL } = require("./expression");
const { operatorMap } = require("./operators");

/**
 * @param {ConditionExpression} expression Expression to evaluate
 * @param {object} context Context to evaluate against; These are values for variables in the expression
 * @returns {boolean} Whether the expression evaluates true or false
 * @throws {Error}
 */
function evaluateExpression(expression, context) {
    /**
     * @type {import("./operators").ConditionOperator|null}
     */
    const operator = operatorMap.get(expression.operator) || null;
    if (operator === null) {
        throw new Error("Unexpected expression operator ID '" + expression.operator + "'. Expected one of [" + operatorMap.keys().join(",") + "]");
    }

    if (!Object.prototype.hasOwnProperty.call(context, expression.variable)) {
        throw new Error("Variable missing in context: " + expression.variable);
    }

    return operator.test(context[expression.variable], expression.value);
}

/**
 * @param {ConditionExpressionGroup} group Group of expressions to evaluate
 * @param {object} context Context to evaluate against; These are values for variables in the expression
 * @returns {boolean} Whether the group evaluates true or false
 * @throws {Error}
 */
function evaluateExpressionGroup(group, context) {
    if (!group.children.length) {
        throw new Error("ConditionExpressionGroup must contain at least one child.");
    }

    let result = null;

    for (const child of group.children) {
        let childResult;

        if (child instanceof ConditionExpression) {
            childResult = evaluateExpression(child, context);
        } else if (child instanceof ConditionExpressionGroup) {
            childResult = evaluateExpressionGroup(child, context);
        } else {
            throw new Error("Invalid child type in ConditionExpressionGroup. Expected ConditionExpression or ConditionExpressionGroup");
        }

        if (result === null) {
            result = childResult; // Initialize result with the first child's result
        } else if (child.andOr === LOGICAL.OR) {
            result = result || childResult;
        } else if (child.andOr === LOGICAL.AND) {
            result = result && childResult;
        } else {
            throw new Error("Invalid logical operator in child of ConditionExpressionGroup. Expected 'and' or 'or'. Got '" + group.andOr + "'");
        }
    }

    if (result === null) {
        throw new Error("ConditionExpressionGroup did not result in a boolean.");
    }

    return result;
}

module.exports = {
    evaluateExpression,
    evaluateExpressionGroup,
};
