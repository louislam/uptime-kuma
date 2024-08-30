class ConditionOperator {
    id = undefined;
    caption = undefined;

    /**
     * @type {mixed} variable
     * @type {mixed} value
     */
    test(variable, value) {
        throw new Error("You need to override test()");
    }
}

const OP_STR_EQUALS = "equals";

const OP_STR_NOT_EQUALS = "not_equals";

const OP_CONTAINS = "contains";

const OP_NOT_CONTAINS = "not_contains";

const OP_NUM_EQUALS = "num_equals";

const OP_NUM_NOT_EQUALS = "num_not_equals";

const OP_LT = "lt";

const OP_GT = "gt";

const OP_LTE = "lte";

const OP_GTE = "gte";

/**
 * Asserts a variable is equal to a value.
 */
class StringEqualsOperator extends ConditionOperator {
    id = OP_STR_EQUALS;
    caption = "equals";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable === value;
    }
}

/**
 * Asserts a variable is not equal to a value.
 */
class StringNotEqualsOperator extends ConditionOperator {
    id = OP_STR_NOT_EQUALS;
    caption = "not equals";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable !== value;
    }
}

/**
 * Asserts a variable contains a value.
 * Handles both Array and String variable types.
 */
class ContainsOperator extends ConditionOperator {
    id = OP_CONTAINS;
    caption = "contains";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        if (Array.isArray(variable)) {
            return variable.includes(value);
        }

        return variable.indexOf(value) !== -1;
    }
}

/**
 * Asserts a variable does not contain a value.
 * Handles both Array and String variable types.
 */
class NotContainsOperator extends ConditionOperator {
    id = OP_NOT_CONTAINS;
    caption = "not contains";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        if (Array.isArray(variable)) {
            return !variable.includes(value);
        }

        return variable.indexOf(value) === -1;
    }
}

/**
 * Asserts a numeric variable is equal to a value.
 */
class NumberEqualsOperator extends ConditionOperator {
    id = OP_NUM_EQUALS;
    caption = "equals";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable === Number(value);
    }
}

/**
 * Asserts a numeric variable is not equal to a value.
 */
class NumberNotEqualsOperator extends ConditionOperator {
    id = OP_NUM_NOT_EQUALS;
    caption = "not equals";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable !== Number(value);
    }
}

/**
 * Asserts a variable is less than a value.
 */
class LessThanOperator extends ConditionOperator {
    id = OP_LT;
    caption = "less than";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable < Number(value);
    }
}

/**
 * Asserts a variable is greater than a value.
 */
class GreaterThanOperator extends ConditionOperator {
    id = OP_GT;
    caption = "greater than";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable > Number(value);
    }
}

/**
 * Asserts a variable is less than or equal to a value.
 */
class LessThanOrEqualToOperator extends ConditionOperator {
    id = OP_LTE;
    caption = "less than or equal to";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable <= Number(value);
    }
}

/**
 * Asserts a variable is greater than or equal to a value.
 */
class GreaterThanOrEqualToOperator extends ConditionOperator {
    id = OP_GTE;
    caption = "greater than or equal to";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable >= Number(value);
    }
}

const operatorMap = new Map([
    [ OP_STR_EQUALS, new StringEqualsOperator ],
    [ OP_STR_NOT_EQUALS, new StringNotEqualsOperator ],
    [ OP_CONTAINS, new ContainsOperator ],
    [ OP_NOT_CONTAINS, new NotContainsOperator ],
    [ OP_NUM_EQUALS, new NumberEqualsOperator ],
    [ OP_NUM_NOT_EQUALS, new NumberNotEqualsOperator ],
    [ OP_LT, new LessThanOperator ],
    [ OP_GT, new GreaterThanOperator ],
    [ OP_LTE, new LessThanOrEqualToOperator ],
    [ OP_GTE, new GreaterThanOrEqualToOperator ],
]);

const defaultStringOperators = [
    operatorMap.get(OP_STR_EQUALS),
    operatorMap.get(OP_STR_NOT_EQUALS),
    operatorMap.get(OP_CONTAINS),
    operatorMap.get(OP_NOT_CONTAINS)
];

const defaultNumberOperators = [
    operatorMap.get(OP_NUM_EQUALS),
    operatorMap.get(OP_NUM_NOT_EQUALS),
    operatorMap.get(OP_LT),
    operatorMap.get(OP_GT),
    operatorMap.get(OP_LTE),
    operatorMap.get(OP_GTE)
];

module.exports = {
    OP_STR_EQUALS,
    OP_STR_NOT_EQUALS,
    OP_CONTAINS,
    OP_NOT_CONTAINS,
    OP_NUM_EQUALS,
    OP_NUM_NOT_EQUALS,
    OP_LT,
    OP_GT,
    OP_LTE,
    OP_GTE,
    operatorMap,
    defaultStringOperators,
    defaultNumberOperators,
    ConditionOperator,
};
