const { describe, test } = require("node:test");
const assert = require("node:assert");

const { validatePassword, MIN_PASSWORD_LENGTH } = require("../../server/password-util");

describe("Password Validation (NIST-aligned)", () => {
    test("should reject empty password", () => {
        const result = validatePassword("");
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject null password", () => {
        const result = validatePassword(null);
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject undefined password", () => {
        const result = validatePassword(undefined);
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject password shorter than minimum length", () => {
        const result = validatePassword("short");
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /at least \d+ characters/i);
    });

    test("should accept password exactly at minimum length", () => {
        const password = "a".repeat(MIN_PASSWORD_LENGTH);
        const result = validatePassword(password);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept long password with only lowercase letters", () => {
        const result = validatePassword("thisisaverylongpassword");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept passphrase without numbers or special characters", () => {
        const result = validatePassword("CorrectHorseBatteryStaple");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with mixed case but no numbers", () => {
        const result = validatePassword("MySecretPassword");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with numbers and special characters", () => {
        const result = validatePassword("MyP@ssw0rd123");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with only numbers", () => {
        const result = validatePassword("12345678");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with only special characters", () => {
        const result = validatePassword("!@#$%^&*");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with spaces", () => {
        const result = validatePassword("my secure password");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept very long password", () => {
        const result = validatePassword("a".repeat(100));
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("minimum password length should be 8 characters", () => {
        assert.strictEqual(MIN_PASSWORD_LENGTH, 8);
    });

    test("should accept Unicode characters", () => {
        const result = validatePassword("パスワード12345");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept emojis in password", () => {
        const result = validatePassword("password🔒🔑");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });
});
