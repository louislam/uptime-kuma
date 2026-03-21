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

const OP_STARTS_WITH = "starts_with";

const OP_NOT_STARTS_WITH = "not_starts_with";

const OP_ENDS_WITH = "ends_with";

const OP_NOT_ENDS_WITH = "not_ends_with";

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
 * Asserts a variable starts with a value.
 */
class StartsWithOperator extends ConditionOperator {
    id = OP_STARTS_WITH;
    caption = "starts with";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable.startsWith(value);
    }
}

/**
 * Asserts a variable does not start with a value.
 */
class NotStartsWithOperator extends ConditionOperator {
    id = OP_NOT_STARTS_WITH;
    caption = "not starts with";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return !variable.startsWith(value);
    }
}

/**
 * Asserts a variable ends with a value.
 */
class EndsWithOperator extends ConditionOperator {
    id = OP_ENDS_WITH;
    caption = "ends with";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return variable.endsWith(value);
    }
}

/**
 * Asserts a variable does not end with a value.
 */
class NotEndsWithOperator extends ConditionOperator {
    id = OP_NOT_ENDS_WITH;
    caption = "not ends with";

    /**
     * @inheritdoc
     */
    test(variable, value) {
        return !variable.endsWith(value);
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

// --- CIDR Operators ---

const OP_IN_CIDR = "in_cidr";
const OP_NOT_IN_CIDR = "not_in_cidr";

function ipToLong(ip) {
    if (typeof ip !== "string") return null;

    const parts = ip.split(".");
    if (parts.length !== 4) return null;

    let num = 0;
    for (let part of parts) {
        const n = Number(part);
        if (isNaN(n) || n < 0 || n > 255) return null;
        num = (num << 8) + n;
    }
    return num >>> 0;
}

function cidrContains(ip, cidr) {
    if (!ip || !cidr) return false;

    const [range, bitsStr] = cidr.split("/");
    const bits = Number(bitsStr);

    if (!range || isNaN(bits) || bits < 0 || bits > 32) {
        return false;
    }

    const ipLong = ipToLong(ip);
    const rangeLong = ipToLong(range);

    if (ipLong === null || rangeLong === null) return false;

    const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1)) >>> 0;

    return (ipLong & mask) === (rangeLong & mask);
}

class InCidrOperator extends ConditionOperator {
    id = OP_IN_CIDR;
    caption = "is in CIDR";

    test(variable, value) {
        if (!variable || !value) return false;

        if (Array.isArray(variable)) {
            return variable.some(ip => cidrContains(ip, value));
        }

        return cidrContains(variable, value);
    }
}

class NotInCidrOperator extends ConditionOperator {
    id = OP_NOT_IN_CIDR;
    caption = "is not in CIDR";

    test(variable, value) {
        if (!variable || !value) return false;

        if (Array.isArray(variable)) {
            return variable.every(ip => !cidrContains(ip, value));
        }

        return !cidrContains(variable, value);
    }
}

const operatorMap = new Map([
    [OP_STR_EQUALS, new StringEqualsOperator()],
    [OP_STR_NOT_EQUALS, new StringNotEqualsOperator()],
    [OP_CONTAINS, new ContainsOperator()],
    [OP_NOT_CONTAINS, new NotContainsOperator()],
    [OP_STARTS_WITH, new StartsWithOperator()],
    [OP_NOT_STARTS_WITH, new NotStartsWithOperator()],
    [OP_ENDS_WITH, new EndsWithOperator()],
    [OP_NOT_ENDS_WITH, new NotEndsWithOperator()],
    [OP_NUM_EQUALS, new NumberEqualsOperator()],
    [OP_NUM_NOT_EQUALS, new NumberNotEqualsOperator()],
    [OP_LT, new LessThanOperator()],
    [OP_GT, new GreaterThanOperator()],
    [OP_LTE, new LessThanOrEqualToOperator()],
    [OP_GTE, new GreaterThanOrEqualToOperator()],
    [OP_IN_CIDR, new InCidrOperator()],
    [OP_NOT_IN_CIDR, new NotInCidrOperator()],
]);

const defaultStringOperators = [
    operatorMap.get(OP_STR_EQUALS),
    operatorMap.get(OP_STR_NOT_EQUALS),
    operatorMap.get(OP_CONTAINS),
    operatorMap.get(OP_NOT_CONTAINS),
    operatorMap.get(OP_STARTS_WITH),
    operatorMap.get(OP_NOT_STARTS_WITH),
    operatorMap.get(OP_ENDS_WITH),
    operatorMap.get(OP_NOT_ENDS_WITH),
    operatorMap.get(OP_IN_CIDR),
    operatorMap.get(OP_NOT_IN_CIDR),
];

const defaultNumberOperators = [
    operatorMap.get(OP_NUM_EQUALS),
    operatorMap.get(OP_NUM_NOT_EQUALS),
    operatorMap.get(OP_LT),
    operatorMap.get(OP_GT),
    operatorMap.get(OP_LTE),
    operatorMap.get(OP_GTE),
];

module.exports = {
    OP_STR_EQUALS,
    OP_STR_NOT_EQUALS,
    OP_CONTAINS,
    OP_NOT_CONTAINS,
    OP_STARTS_WITH,
    OP_NOT_STARTS_WITH,
    OP_ENDS_WITH,
    OP_NOT_ENDS_WITH,
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
    OP_IN_CIDR,
    OP_NOT_IN_CIDR,
};
