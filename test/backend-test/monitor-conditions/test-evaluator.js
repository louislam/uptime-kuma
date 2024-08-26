const test = require("node:test");
const assert = require("node:assert");
const { ConditionExpressionGroup, ConditionExpression, LOGICAL } = require("../../../server/monitor-conditions/expression.js");
const { evaluateExpressionGroup, evaluateExpression } = require("../../../server/monitor-conditions/evaluator.js");

test("Test evaluateExpression", async (t) => {
    const expr = new ConditionExpression("record", "contains", "mx1.example.com");
    assert.strictEqual(true, evaluateExpression(expr, { record: "mx1.example.com" }));
    assert.strictEqual(false, evaluateExpression(expr, { record: "mx2.example.com" }));
});

test("Test evaluateExpressionGroup with logical AND", async (t) => {
    const group = new ConditionExpressionGroup([
        new ConditionExpression("record", "contains", "mx1."),
        new ConditionExpression("record", "contains", "example.com", LOGICAL.AND),
    ]);
    assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.com" }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1." }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.com" }));
});

test("Test evaluateExpressionGroup with logical OR", async (t) => {
    const group = new ConditionExpressionGroup([
        new ConditionExpression("record", "contains", "example.com"),
        new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
    ]);
    assert.strictEqual(true, evaluateExpressionGroup(group, { record: "example.com" }));
    assert.strictEqual(true, evaluateExpressionGroup(group, { record: "example.org" }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.net" }));
});

test("Test evaluateExpressionGroup with nested group", async (t) => {
    const group = new ConditionExpressionGroup([
        new ConditionExpression("record", "contains", "mx1."),
        new ConditionExpressionGroup([
            new ConditionExpression("record", "contains", "example.com"),
            new ConditionExpression("record", "contains", "example.org", LOGICAL.OR),
        ]),
    ]);
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1." }));
    assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.com" }));
    assert.strictEqual(true, evaluateExpressionGroup(group, { record: "mx1.example.org" }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.com" }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "example.org" }));
    assert.strictEqual(false, evaluateExpressionGroup(group, { record: "mx1.example.net" }));
});
