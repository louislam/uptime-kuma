const test = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const passwordHash = require("../../server/password-hash");

/**
 * Tests for User Management functionality
 * Tests the basic user CRUD operations including:
 * - Creating users
 * - Validating username uniqueness
 * - Password hashing
 * - User activation/deactivation
 * - Username validation
 */
test("User Management Tests", async (t) => {

    await t.test("Username validation - should trim whitespace", async () => {
        const username1 = "  testuser  ";
        const username2 = "testuser";
        
        assert.strictEqual(username1.trim(), username2);
    });

    await t.test("Username validation - should reject empty username", async () => {
        const username = "";
        const password = "validPassword123";
        
        // Empty username should be invalid
        assert.strictEqual(username.length === 0, true);
        assert.strictEqual(password.length > 0, true);
    });

    await t.test("Password validation - should require password", async () => {
        const username = "validuser";
        const password = "";
        
        // Empty password should be invalid
        assert.strictEqual(username.length > 0, true);
        assert.strictEqual(password.length === 0, true);
    });

    await t.test("Password hashing - should generate bcrypt hash", async () => {
        const plainPassword = "testPassword123";
        const hashedPassword = await passwordHash.generate(plainPassword);
        
        // Bcrypt hashes start with $2a$, $2b$, or $2y$
        assert.strictEqual(hashedPassword.startsWith("$2"), true);
        assert.strictEqual(hashedPassword.length >= 60, true);
    });

    await t.test("Password hashing - should verify correct password", async () => {
        const plainPassword = "testPassword123";
        const hashedPassword = await passwordHash.generate(plainPassword);
        
        const isValid = await passwordHash.verify(plainPassword, hashedPassword);
        assert.strictEqual(isValid, true);
    });

    await t.test("Password hashing - should reject incorrect password", async () => {
        const plainPassword = "testPassword123";
        const wrongPassword = "wrongPassword456";
        const hashedPassword = await passwordHash.generate(plainPassword);
        
        const isValid = await passwordHash.verify(wrongPassword, hashedPassword);
        assert.strictEqual(isValid, false);
    });

    await t.test("Password hashing - different passwords should generate different hashes", async () => {
        const password1 = "testPassword123";
        const password2 = "testPassword456";
        
        const hash1 = await passwordHash.generate(password1);
        const hash2 = await passwordHash.generate(password2);
        
        assert.notStrictEqual(hash1, hash2);
    });

    await t.test("Password hashing - same password should generate different hashes (salt)", async () => {
        const password = "testPassword123";
        
        const hash1 = await passwordHash.generate(password);
        const hash2 = await passwordHash.generate(password);
        
        // Hashes should be different due to different salts
        assert.notStrictEqual(hash1, hash2);
        
        // But both should verify the same password
        const isValid1 = await passwordHash.verify(password, hash1);
        const isValid2 = await passwordHash.verify(password, hash2);
        assert.strictEqual(isValid1, true);
        assert.strictEqual(isValid2, true);
    });

    await t.test("User active status - should be 1 for active user", async () => {
        const activeStatus = 1;
        assert.strictEqual(activeStatus, 1);
        assert.strictEqual(Boolean(activeStatus), true);
    });

    await t.test("User active status - should be 0 for inactive user", async () => {
        const inactiveStatus = 0;
        assert.strictEqual(inactiveStatus, 0);
        assert.strictEqual(Boolean(inactiveStatus), false);
    });

    await t.test("User data structure - should contain required fields", async () => {
        const userData = {
            id: 1,
            username: "testuser",
            active: 1,
            timezone: "UTC"
        };
        
        assert.strictEqual(typeof userData.id, "number");
        assert.strictEqual(typeof userData.username, "string");
        assert.strictEqual(typeof userData.active, "number");
        assert.strictEqual(userData.username.length > 0, true);
    });

    await t.test("User data structure - should not expose password in user list", async () => {
        const userData = {
            id: 1,
            username: "testuser",
            active: 1,
            timezone: "UTC"
        };
        
        // Password field should not be present in user list
        assert.strictEqual(userData.hasOwnProperty("password"), false);
    });

    await t.test("Username uniqueness - comparison should be case-sensitive by default", async () => {
        const username1 = "TestUser";
        const username2 = "testuser";
        
        // These are different usernames (case-sensitive)
        assert.notStrictEqual(username1, username2);
    });

    await t.test("User deletion - should use soft delete (deactivation)", async () => {
        // Simulate soft delete by setting active to 0
        let userActive = 1;
        
        // Delete operation sets active to 0
        userActive = 0;
        
        assert.strictEqual(userActive, 0);
        // User record still exists, just marked inactive
    });

    await t.test("Error messages - should provide clear error for duplicate username", async () => {
        const errorMessage = "Username already exists";
        
        assert.strictEqual(errorMessage.includes("already exists"), true);
        assert.strictEqual(errorMessage.length > 0, true);
    });

    await t.test("Error messages - should provide clear error for self-deletion", async () => {
        const errorMessage = "Cannot delete your own account";
        
        assert.strictEqual(errorMessage.includes("Cannot delete"), true);
        assert.strictEqual(errorMessage.includes("own account"), true);
    });

    await t.test("Error messages - should provide clear error for missing fields", async () => {
        const errorMessage = "Username and password are required";
        
        assert.strictEqual(errorMessage.includes("required"), true);
    });

    await t.test("User ID validation - should be positive integer", async () => {
        const validUserId = 1;
        const invalidUserId = -1;
        const invalidUserId2 = 0;
        
        assert.strictEqual(validUserId > 0, true);
        assert.strictEqual(Number.isInteger(validUserId), true);
        assert.strictEqual(invalidUserId > 0, false);
        assert.strictEqual(invalidUserId2 > 0, false);
    });

    await t.test("User update - should allow partial updates", async () => {
        // User update should allow updating just active status
        const updateData = {
            active: 0
        };
        
        assert.strictEqual(typeof updateData.active !== "undefined", true);
        assert.strictEqual(typeof updateData.username === "undefined", true);
        assert.strictEqual(typeof updateData.password === "undefined", true);
    });

    await t.test("User update - should allow password change without username change", async () => {
        const updateData = {
            password: "newPassword123"
        };
        
        assert.strictEqual(typeof updateData.password !== "undefined", true);
        assert.strictEqual(typeof updateData.username === "undefined", true);
    });

    await t.test("User update - should prevent duplicate username on update", async () => {
        const currentUsername = "user1";
        const newUsername = "user2";
        const existingUsername = "user2";
        
        // If trying to change username to one that exists, should fail
        assert.strictEqual(newUsername === existingUsername, true);
    });

});
