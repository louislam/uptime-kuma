const test = require("node:test");
const assert = require("node:assert");

const { getDaysRemaining, getDaysBetween } = require("../../server/util-server");

test("Test getDaysBetween", async (t) => {
    let days = getDaysBetween(new Date(2025, 9, 7), new Date(2025, 9, 10));
    assert.strictEqual(days, 3);
    days = getDaysBetween(new Date(2024, 9, 7), new Date(2025, 9, 10));
    assert.strictEqual(days, 368);
});

test("Test getDaysRemaining", async (t) => {
    let days = getDaysRemaining(new Date(2025, 9, 7), new Date(2025, 9, 10));
    assert.strictEqual(days, 3);
    days = getDaysRemaining(new Date(2025, 9, 10), new Date(2025, 9, 7));
    assert.strictEqual(days, -3);
});
