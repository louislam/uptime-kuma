const test = require("node:test");
const assert = require("node:assert");

const hash = require("../../server/modules/axios-ntlm/lib/hash");

test("Test createPseudoRandomValue", async (t) => {
    await t.test("Should create string of specified length", () => {
        const length = 16;
        const result = hash.createPseudoRandomValue(length);
        assert.strictEqual(result.length, length, "Result should have the specified length");
        assert.strictEqual(typeof result, "string", "Result should be a string");
    });

    await t.test("Should create string of different lengths", () => {
        const lengths = [ 8, 16, 32, 64 ];
        for (const length of lengths) {
            const result = hash.createPseudoRandomValue(length);
            assert.strictEqual(result.length, length, `Result should have length ${length}`);
        }
    });

    await t.test("Should return valid hexadecimal string", () => {
        const length = 32;
        const result = hash.createPseudoRandomValue(length);
        const hexRegex = /^[0-9a-f]+$/;
        assert.ok(hexRegex.test(result), "Result should be a valid hexadecimal string");
    });

    await t.test("Should create different values on multiple calls", () => {
        const length = 16;
        const results = new Set();
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            results.add(hash.createPseudoRandomValue(length));
        }

        // Due to randomness, at least some values should be different
        assert.ok(results.size > 1, "Multiple calls should produce different values");
    });

    await t.test("Should handle length of 0", () => {
        const result = hash.createPseudoRandomValue(0);
        assert.strictEqual(result.length, 0, "Result should be empty string for length 0");
        assert.strictEqual(result, "", "Result should be empty string");
    });
});
