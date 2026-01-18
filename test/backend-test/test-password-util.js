const { describe, test } = require("node:test");
const assert = require("node:assert");

const { validatePassword, checkPasswordBreached, MIN_PASSWORD_LENGTH } = require("../../server/password-util");

describe("Password Validation (NIST-aligned)", () => {
    test("should reject empty password", async () => {
        const result = await validatePassword("");
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject null password", async () => {
        const result = await validatePassword(null);
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject undefined password", async () => {
        const result = await validatePassword(undefined);
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /cannot be empty/i);
    });

    test("should reject password shorter than minimum length", async () => {
        const result = await validatePassword("short");
        assert.strictEqual(result.ok, false);
        assert.match(result.msg, /at least \d+ characters/i);
    });

    test("should accept password exactly at minimum length", async () => {
        const password = "a".repeat(MIN_PASSWORD_LENGTH);
        const result = await validatePassword(password);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept long password with only lowercase letters", async () => {
        const result = await validatePassword("thisisaverylongpassword");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept passphrase without numbers or special characters", async () => {
        const result = await validatePassword("CorrectHorseBatteryStaple");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with mixed case but no numbers", async () => {
        const result = await validatePassword("MySecretPassword");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with numbers and special characters", async () => {
        const result = await validatePassword("MyP@ssw0rd123");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with only numbers", async () => {
        const result = await validatePassword("123456789012");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with only special characters", async () => {
        const result = await validatePassword("!@#$%^&*(){}");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept password with spaces", async () => {
        const result = await validatePassword("my secure password here");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept very long password", async () => {
        const result = await validatePassword("a".repeat(100));
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("minimum password length should be 12 characters", () => {
        assert.strictEqual(MIN_PASSWORD_LENGTH, 12);
    });

    test("should accept Unicode characters", async () => {
        const result = await validatePassword("パスワード123456789");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should accept emojis in password", async () => {
        const result = await validatePassword("password🔒🔑123");
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.msg, undefined);
    });

    test("should warn about breached password when checking enabled", async () => {
        // "password" is a well-known breached password
        const result = await validatePassword("password123456", true);
        assert.strictEqual(result.ok, true);
        assert.ok(result.warning, "Should have a warning for breached password");
        assert.strictEqual(result.warning.msg, "passwordFoundInDataBreach");
        assert.ok(result.warning.meta > 0, "Should have breach count greater than 0");
    });

    test("should accept non-breached password with no warning", async () => {
        // Very unlikely to be breached (random strong password)
        const result = await validatePassword("Xy9#mK2$pQ7!vN8&", true);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.warning, undefined);
    });
});

describe("HIBP Breach Checking", () => {
    test("checkPasswordBreached should detect common password", async () => {
        const result = await checkPasswordBreached("password");
        assert.strictEqual(result.breached, true);
        assert.ok(result.count > 1000000, "Password should have been breached many times");
    });

    test("checkPasswordBreached should not detect strong unique password", async () => {
        // Very unlikely to be in breach database
        const result = await checkPasswordBreached("Xy9#mK2$pQ7!vN8&zR4@");
        assert.strictEqual(result.breached, false);
        assert.strictEqual(result.count, 0);
    });
});
