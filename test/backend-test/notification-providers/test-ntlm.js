const { describe, test } = require("node:test");
const assert = require("node:assert");

const hash = require("../../../server/modules/axios-ntlm/lib/hash");

describe("createPseudoRandomValue()", () => {
    test("returns a hexadecimal string with the requested length", () => {
        for (const length of [ 0, 8, 16, 32, 64 ]) {
            const result = hash.createPseudoRandomValue(length);
            assert.strictEqual(typeof result, "string");
            assert.strictEqual(result.length, length);
            assert.ok(/^[0-9a-f]*$/.test(result));
        }
    });

    test("returns unique values across multiple calls with the same length", () => {
        const length = 16;
        const iterations = 10;
        const results = new Set();

        for (let i = 0; i < iterations; i++) {
            results.add(hash.createPseudoRandomValue(length));
        }

        assert.strictEqual(results.size, iterations);
    });
});
