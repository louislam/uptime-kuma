const test = require("node:test");
const assert = require("node:assert");
const { operatorMap, OP_CONTAINS, OP_NOT_CONTAINS, OP_LT, OP_GT, OP_LTE, OP_GTE, OP_STR_EQUALS, OP_STR_NOT_EQUALS, OP_NUM_EQUALS, OP_NUM_NOT_EQUALS, OP_STARTS_WITH, OP_ENDS_WITH, OP_NOT_STARTS_WITH, OP_NOT_ENDS_WITH } = require("../../../server/monitor-conditions/operators.js");

test("Expression Operators", async (t) => {
    await t.test("StringEqualsOperator returns true for identical strings and false otherwise", async (t) => {
        const op = operatorMap.get(OP_STR_EQUALS);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1.example.com"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1.example.org"));
        assert.strictEqual(false, op.test("1", 1)); // strict equality
    });

    await t.test("StringNotEqualsOperator returns true for different strings and false for identical strings", async (t) => {
        const op = operatorMap.get(OP_STR_NOT_EQUALS);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1.example.org"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1.example.com"));
        assert.strictEqual(true, op.test(1, "1")); // variable is not typecasted (strict equality)
    });

    await t.test("ContainsOperator returns true when scalar contains substring", async (t) => {
        const op = operatorMap.get(OP_CONTAINS);
        assert.strictEqual(true, op.test("mx1.example.org", "example.org"));
        assert.strictEqual(false, op.test("mx1.example.org", "example.com"));
    });

    await t.test("ContainsOperator returns true when array contains element", async (t) => {
        const op = operatorMap.get(OP_CONTAINS);
        assert.strictEqual(true, op.test([ "example.org" ], "example.org"));
        assert.strictEqual(false, op.test([ "example.org" ], "example.com"));
    });

    await t.test("NotContainsOperator returns true when scalar does not contain substring", async (t) => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        assert.strictEqual(true, op.test("example.org", ".com"));
        assert.strictEqual(false, op.test("example.org", ".org"));
    });

    await t.test("NotContainsOperator returns true when array does not contain element", async (t) => {
        const op = operatorMap.get(OP_NOT_CONTAINS);
        assert.strictEqual(true, op.test([ "example.org" ], "example.com"));
        assert.strictEqual(false, op.test([ "example.org" ], "example.org"));
    });

    await t.test("StartsWithOperator returns true when string starts with prefix", async (t) => {
        const op = operatorMap.get(OP_STARTS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "mx1"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx2"));
    });

    await t.test("NotStartsWithOperator returns true when string does not start with prefix", async (t) => {
        const op = operatorMap.get(OP_NOT_STARTS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "mx2"));
        assert.strictEqual(false, op.test("mx1.example.com", "mx1"));
    });

    await t.test("EndsWithOperator returns true when string ends with suffix", async (t) => {
        const op = operatorMap.get(OP_ENDS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "example.com"));
        assert.strictEqual(false, op.test("mx1.example.com", "example.net"));
    });

    await t.test("NotEndsWithOperator returns true when string does not end with suffix", async (t) => {
        const op = operatorMap.get(OP_NOT_ENDS_WITH);
        assert.strictEqual(true, op.test("mx1.example.com", "example.net"));
        assert.strictEqual(false, op.test("mx1.example.com", "example.com"));
    });

    await t.test("NumberEqualsOperator returns true for equal numbers with type coercion", async (t) => {
        const op = operatorMap.get(OP_NUM_EQUALS);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(1, "1"));
        assert.strictEqual(false, op.test(1, "2"));
    });

    await t.test("NumberNotEqualsOperator returns true for different numbers", async (t) => {
        const op = operatorMap.get(OP_NUM_NOT_EQUALS);
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, "1"));
    });

    await t.test("LessThanOperator returns true when first number is less than second", async (t) => {
        const op = operatorMap.get(OP_LT);
        assert.strictEqual(true, op.test(1, 2));
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, 1));
    });

    await t.test("GreaterThanOperator returns true when first number is greater than second", async (t) => {
        const op = operatorMap.get(OP_GT);
        assert.strictEqual(true, op.test(2, 1));
        assert.strictEqual(true, op.test(2, "1"));
        assert.strictEqual(false, op.test(1, 1));
    });

    await t.test("LessThanOrEqualToOperator returns true when first number is less than or equal to second", async (t) => {
        const op = operatorMap.get(OP_LTE);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(1, 2));
        assert.strictEqual(true, op.test(1, "2"));
        assert.strictEqual(false, op.test(1, 0));
    });

    await t.test("GreaterThanOrEqualToOperator returns true when first number is greater than or equal to second", async (t) => {
        const op = operatorMap.get(OP_GTE);
        assert.strictEqual(true, op.test(1, 1));
        assert.strictEqual(true, op.test(2, 1));
        assert.strictEqual(true, op.test(2, "2"));
        assert.strictEqual(false, op.test(2, 3));
    });
});
