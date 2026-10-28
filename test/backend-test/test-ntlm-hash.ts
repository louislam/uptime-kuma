import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const crypto = require("crypto");
const hash = require("../../server/modules/axios-ntlm/lib/hash.js");

/**
 * Replace crypto.createHash for one test
 * @param {Function} replacement Stub
 * @returns {Function} Restore function
 */
function stubCreateHash(replacement) {
    const original = crypto.createHash;
    crypto.createHash = replacement;
    return () => {
        crypto.createHash = original;
    };
}

// Known NTLM hash vectors: MD4 of the password encoded as UTF-16LE
describe("NTLM hash", () => {
    describe("createNTLMHash()", () => {
        test("returns the documented hash for the password 'Password'", () => {
            assert.strictEqual(hash.createNTLMHash("Password").toString("hex"), "a4f49c406510bdcab6824ee7c30fd852");
        });

        test("returns the documented hash for an empty password", () => {
            assert.strictEqual(hash.createNTLMHash("").toString("hex"), "31d6cfe0d16ae931b73c59d7e0c089c0");
        });

        test("encodes the password as UTF-16LE before hashing", () => {
            assert.strictEqual(hash.createNTLMHash("päss").toString("hex"), "411b68984d6b19bbb302455798320a06");
        });
    });
});

describe("MD4 fallback", () => {
    test("uses js-md4 when OpenSSL rejects MD4", () => {
        const restore = stubCreateHash(() => {
            const error = new Error("Digest method not supported");
            error.code = "ERR_OSSL_EVP_UNSUPPORTED";
            throw error;
        });

        try {
            assert.strictEqual(hash.createNTLMHash("Password").toString("hex"), "a4f49c406510bdcab6824ee7c30fd852");
        } finally {
            restore();
        }
    });

    test("rethrows other crypto errors", () => {
        const restore = stubCreateHash(() => {
            const error = new Error("boom");
            error.code = "EOTHER";
            throw error;
        });

        try {
            assert.throws(() => hash.createNTLMHash("Password"), /boom/);
        } finally {
            restore();
        }
    });
});
