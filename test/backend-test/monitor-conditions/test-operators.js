const { describe, test } = require("node:test");
const assert = require("node:assert");
const { operatorMap, OP_CONTAINS, OP_NOT_CONTAINS, OP_LT, OP_GT, OP_LTE, OP_GTE, OP_STR_EQUALS, OP_STR_NOT_EQUALS, OP_NUM_EQUALS, OP_NUM_NOT_EQUALS, OP_STARTS_WITH, OP_ENDS_WITH, OP_NOT_STARTS_WITH, OP_NOT_ENDS_WITH } = require("../../../server/monitor-conditions/operators.js");

describe("Expression Operators", () => {
    test("StringEqualsOperator returns true for identical strings and false otherwise", () => {
        const op = operatorMap.get(OP_STR_EQUALS);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1.example.com"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1.example.org"));
        assert.strictEqual(false, op.test("1", 1)); // strict equality
    });

    test("StringNotEqualsOperator returns true for different strings and false for identical strings", () => {
        const op = operatorMap.get(OP_STR_NOT_EQUALS);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1.example.org"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1.example.com"));
        assert.strictEqual(true, op.test(1, "1")); // variable is not typecasted (strict equality)
    });

    test("ContainsOperator returns true when scalar contains substring", () => {
        const op = operatorMap.get(OP_CONTAINS);
        assert.strictEqual(true, op.test("mx1.example.org", "example.org"));
        assert.strictEqual(false, op.test("mx1.example.org", "example.com"));
    });

    test("ContainsOperator returns true when array contains element", () => {
        const op = operatorMap.get(OP_CONTAINS);
        assert.strictEqual(true, op.test([ "example.org" ], "example.org"));
        assert.strictEqual(false, op.test([ "example.org" ], "example.com"));
    });

    test("NotContainsOperator returns true when scalar does not contain substring", () => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        assert.strictEqual(true, op.test("example.org", ".com"));
        assert.strictEqual(false, op.test("example.org", ".org"));
    });

    test("NotContainsOperator returns true when array does not contain element", () => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        assert.strictEqual(true, op.test([ "example.org" ], "example.com"));
        assert.strictEqual(false, op.test([ "example.org" ], "example.org"));
    });

    test("StartsWithOperator returns true when string starts with prefix", () => {
        const op = operatorMap.get(OP_STARTS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx2"));
    });

    test("NotStartsWithOperator returns true when string does not start with prefix", () => {
        const op = operatorMap.get(OP_NOT_STARTS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "mx2"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1"));
    });

    test("EndsWithOperator returns true when string ends with suffix", () => {
        const op = operatorMap.get(OP_ENDS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "example.com"));
        assert.strictEqual(false, op.test("mx1.example.com", "example.net"));
    });

    test("NotEndsWithOperator returns true when string does not end with suffix", () => {
        const op = operatorMap.get(OP_NOT_ENDS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "example.net"));
        assert.strictEqual(false, op.test("mx1.example.com", "example.com"));
    });

    test("NumberEqualsOperator returns true for equal numbers with type coercion", () => {
        const op = operatorMap.get(OP_NUM_EQUALS);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(1, "1"));
        assert.strictEqual(false, op.test(1, "2"));
    });

    test("NumberNotEqualsOperator returns true for different numbers", () => {
        const op = operatorMap.get(OP_NUM_NOT_EQUALS);
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, "1"));
    });

    test("LessThanOperator returns true when first number is less than second", () => {
        const op = operatorMap.get(OP_LT);
        assert.strictEqual(true, op.test(1, 2));
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, 1));
    });

    test("GreaterThanOperator returns true when first number is greater than second", () => {
        const op = operatorMap.get(OP_GT);
        assert.strictEqual(true, op.test(2, 1));
        assert.strictEqual(true, op.test(2, "1"));
        assert.strictEqual(false, op.test(1, 1));
    });

    test("LessThanOrEqualToOperator returns true when first number is less than or equal to second", () => {
        const op = operatorMap.get(OP_LTE);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(1, 2));
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, 0));
    });

    test("GreaterThanOrEqualToOperator returns true when first number is greater than or equal to second", () => {
        const op = operatorMap.get(OP_GTE);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(2, 1));
        assert.strictEqual(true, op.test(2, "2"));
        assert.strictEqual(false, op.test(2, 3));
    });
});
