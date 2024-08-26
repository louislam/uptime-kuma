const test = require("node:test");
const assert = require("node:assert");
const { operatorMap, OP_EQUALS, OP_NOT_EQUALS, OP_CONTAINS, OP_NOT_CONTAINS, OP_LT, OP_GT, OP_LTE, OP_GTE } = require("../../../server/monitor-conditions/operators.js");

test("Test EqualsOperator", async (t) => {
    const op = operatorMap.get(OP_EQUALS);
    assert.strictEqual(true, op.test("foo", "foo"));
    assert.strictEqual(false, op.test("foo", "bar"));
    assert.strictEqual(true, op.test("1", "1"));
});

test("Test EqualsOperator is not strict equality", async (t) => {
    const op = operatorMap.get(OP_EQUALS);
    assert.strictEqual(true, op.test(1, "1"));
});

test("Test NotEqualsOperator", async (t) => {
    const op = operatorMap.get(OP_NOT_EQUALS);
    assert.strictEqual(true, op.test("foo", "bar"));
    assert.strictEqual(false, op.test("foo", "foo"));
});

test("Test NotEqualsOperator is not strict equality", async (t) => {
    const op = operatorMap.get(OP_NOT_EQUALS);
    assert.strictEqual(false, op.test(1, "1"));
});

test("Test ContainsOperator with scalar", async (t) => {
    const op = operatorMap.get(OP_CONTAINS);
    assert.strictEqual(true, op.test("example.org", ".org"));
    assert.strictEqual(false, op.test("example.org", ".com"));
});

test("Test ContainsOperator with array", async (t) => {
    const op = operatorMap.get(OP_CONTAINS);
    assert.strictEqual(true, op.test([ "example.org" ], "example.org"));
    assert.strictEqual(false, op.test([ "example.org" ], "example.com"));
});

test("Test NotContainsOperator with scalar", async (t) => {
    const op = operatorMap.get(OP_NOT_CONTAINS);
    assert.strictEqual(true, op.test("example.org", ".com"));
    assert.strictEqual(false, op.test("example.org", ".org"));
});

test("Test NotContainsOperator with array", async (t) => {
    const op = operatorMap.get(OP_NOT_CONTAINS);
    assert.strictEqual(true, op.test([ "example.org" ], "example.com"));
    assert.strictEqual(false, op.test([ "example.org" ], "example.org"));
});

test("Test LessThanOperator", async (t) => {
    const op = operatorMap.get(OP_LT);
    assert.strictEqual(true, op.test(1, 2));
    assert.strictEqual(true, op.test(1, "2"));
    assert.strictEqual(false, op.test(1, 1));
});

test("Test GreaterThanOperator", async (t) => {
    const op = operatorMap.get(OP_GT);
    assert.strictEqual(true, op.test(2, 1));
    assert.strictEqual(true, op.test(2, "1"));
    assert.strictEqual(false, op.test(1, 1));
});

test("Test LessThanOrEqualToOperator", async (t) => {
    const op = operatorMap.get(OP_LTE);
    assert.strictEqual(true, op.test(1, 1));
    assert.strictEqual(true, op.test(1, 2));
    assert.strictEqual(true, op.test(1, "2"));
    assert.strictEqual(false, op.test(1, 0));
});

test("Test GreaterThanOrEqualToOperator", async (t) => {
    const op = operatorMap.get(OP_GTE);
    assert.strictEqual(true, op.test(1, 1));
    assert.strictEqual(true, op.test(2, 1));
    assert.strictEqual(true, op.test(2, "2"));
    assert.strictEqual(false, op.test(2, 3));
});
