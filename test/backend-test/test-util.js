const { describe, test } = require("node:test");
const assert = require("node:assert");

const { getDaysRemaining, getDaysBetween } = require("../../server/util-server");

describe("Server Utilities", () => {
    test("getDaysBetween() calculates days between dates within same month", () => {
        const days = getDaysBetween(new Date(2025, 9, 7), new Date(2025, 9, 10));
        assert.strictEqual(days, 3);
    });

    test("getDaysBetween() calculates days between dates across years", () => {
        const days = getDaysBetween(new Date(2024, 9, 7), new Date(2025, 9, 10));
        assert.strictEqual(days, 368);
    });

    test("getDaysRemaining() returns positive value when target date is in future", () => {
        const days = getDaysRemaining(new Date(2025, 9, 7), new Date(2025, 9, 10));
        assert.strictEqual(days, 3);
    });

    test("getDaysRemaining() returns negative value when target date is in past", () => {
        const days = getDaysRemaining(new Date(2025, 9, 10), new Date(2025, 9, 7));
        assert.strictEqual(days, -3);
    });
});
