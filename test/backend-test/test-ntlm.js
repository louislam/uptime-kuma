const test = require("node:test");
const assert = require("node:assert");

const hash = require("../../server/modules/axios-ntlm/lib/hash");

test("Test createPseudoRandomValue", async (t) => {
    await t.test("Should create string of different lengths", () => {
        const lengths = [ 0, 8, 16, 32, 64 ];
        const hexRegex = /^[0-9a-f]*$/;
        for (const length of lengths) {
            const result = hash.createPseudoRandomValue(length);
            assert.strictEqual(result.length, length, `Result should have length ${length}`);
            assert.strictEqual(typeof result, "string", "Result should be a string");
            assert.ok(hexRegex.test(result), "Result should be a valid hexadecimal string");
        }
    });

    await t.test("Should create different values on multiple calls", () => {
        const length = 16;
        const results = new Set();
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            results.add(hash.createPseudoRandomValue(length));
        }

        assert.strictEqual(results.size, iterations, "All generated values should be unique");
    });
});