import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const passwordHash = require("../../server/password-hash");
const legacyPasswordHash = require("password-hash");

describe("password-hash", () => {
    test("generate() returns a bcrypt hash", async () => {
        const hash = await passwordHash.generate("secret");

        assert.match(hash, /^\$2[aby]\$/);
        assert.notStrictEqual(hash, "secret");
    });

    test("verify() accepts the matching password", async () => {
        const hash = await passwordHash.generate("secret");

        assert.strictEqual(passwordHash.verify("secret", hash), true);
    });

    test("verify() rejects a wrong password", async () => {
        const hash = await passwordHash.generate("secret");

        assert.strictEqual(passwordHash.verify("wrong", hash), false);
    });

    test("needRehash() is false for a current bcrypt hash", async () => {
        const hash = await passwordHash.generate("secret");

        assert.strictEqual(passwordHash.needRehash(hash), false);
    });

    test("verify() still accepts a legacy sha1 hash", () => {
        const legacyHash = legacyPasswordHash.generate("secret", { algorithm: "sha1" });

        assert.strictEqual(passwordHash.verify("secret", legacyHash), true);
        assert.strictEqual(passwordHash.verify("wrong", legacyHash), false);
    });

    test("needRehash() asks for a rehash of a legacy sha1 hash", () => {
        const legacyHash = legacyPasswordHash.generate("secret", { algorithm: "sha1" });

        assert.strictEqual(passwordHash.needRehash(legacyHash), true);
    });
});
