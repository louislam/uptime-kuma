const test = require("node:test");
const assert = require("node:assert");
const { validateUsername, RESERVED_USERNAMES } = require("../../server/user-validator");

test("Test username validation - minimum length", async (t) => {
    assert.throws(() => {
        validateUsername("ab");
    }, { message: "Username must be at least 3 characters long" });

    assert.throws(() => {
        validateUsername("a");
    }, { message: "Username must be at least 3 characters long" });

    assert.throws(() => {
        validateUsername("");
    }, { message: "Username must be at least 3 characters long" });

    // Should not throw
    assert.doesNotThrow(() => {
        validateUsername("abc");
    });
});

test("Test username validation - maximum length", async (t) => {
    const longUsername = "a".repeat(51);
    assert.throws(() => {
        validateUsername(longUsername);
    }, { message: "Username must not exceed 50 characters" });

    // Should not throw
    const validLongUsername = "a".repeat(50);
    assert.doesNotThrow(() => {
        validateUsername(validLongUsername);
    });
});

test("Test username validation - allowed characters", async (t) => {
    // Invalid characters
    assert.throws(() => {
        validateUsername("user@name");
    }, { message: "Username can only contain letters, numbers, dots, hyphens, and underscores" });

    assert.throws(() => {
        validateUsername("user name");
    }, { message: "Username can only contain letters, numbers, dots, hyphens, and underscores" });

    assert.throws(() => {
        validateUsername("user#name");
    }, { message: "Username can only contain letters, numbers, dots, hyphens, and underscores" });

    assert.throws(() => {
        validateUsername("user$name");
    }, { message: "Username can only contain letters, numbers, dots, hyphens, and underscores" });

    // Valid characters
    assert.doesNotThrow(() => {
        validateUsername("user_name");
    });

    assert.doesNotThrow(() => {
        validateUsername("user-name");
    });

    assert.doesNotThrow(() => {
        validateUsername("user.name");
    });

    assert.doesNotThrow(() => {
        validateUsername("user123");
    });

    assert.doesNotThrow(() => {
        validateUsername("User_Name-123.test");
    });
});

test("Test username validation - reserved usernames", async (t) => {
    for (const username of RESERVED_USERNAMES) {
        // Test lowercase
        assert.throws(() => {
            validateUsername(username);
        }, { message: "This username is reserved and cannot be used" });

        // Test uppercase
        assert.throws(() => {
            validateUsername(username.toUpperCase());
        }, { message: "This username is reserved and cannot be used" });

        // Test mixed case
        assert.throws(() => {
            validateUsername(username.charAt(0).toUpperCase() + username.slice(1));
        }, { message: "This username is reserved and cannot be used" });
    }
});

test("Test username validation - valid usernames", async (t) => {
    const validUsernames = [
        "john",
        "john_doe",
        "john-doe",
        "john.doe",
        "john123",
        "john_doe_123",
        "john-doe-123",
        "john.doe.123",
        "JOHN",
        "JohnDoe",
        "john_DOE",
    ];

    for (const username of validUsernames) {
        assert.doesNotThrow(() => {
            validateUsername(username);
        });
    }
});

test("Test username validation - trimming", async (t) => {
    // Should trim whitespace
    assert.doesNotThrow(() => {
        validateUsername("  john  ");
    });

    // But should fail if trimmed length is too short
    assert.throws(() => {
        validateUsername("  ab  ");
    }, { message: "Username must be at least 3 characters long" });
});
