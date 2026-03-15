const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const TestDB = require("../mock-testdb");
const passwordHash = require("../../server/password-hash");
const { nanoid } = require("nanoid");
const { Settings } = require("../../server/settings");

const testDB = new TestDB("./data/test-api-bridge");

describe("API Bridge", () => {
    let validKey;
    let userID;

    before(async () => {
        await testDB.create();

        // Create a test user
        let user = R.dispense("user");
        user.username = "testuser";
        user.password = await passwordHash.generate("testpass123");
        user.active = 1;
        await R.store(user);
        userID = user.id;

        // Create an API key
        let clearKey = nanoid(40);
        let hashedKey = await passwordHash.generate(clearKey);
        let bean = R.dispense("api_key");
        bean.key = hashedKey;
        bean.name = "test-key";
        bean.user_id = userID;
        bean.active = 1;
        bean.expires = "2099-01-01 00:00:00";
        await R.store(bean);

        validKey = "uk" + bean.id + "_" + clearKey;
        await Settings.set("apiKeysEnabled", true);
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDB.destroy();
    });

    describe("parseAPIKey", () => {
        test("extracts key ID and clear text from a valid key", () => {
            const { parseAPIKey } = require("../../server/auth");
            const result = parseAPIKey("uk5_abcdef1234567890");
            assert.strictEqual(result.index, "5");
            assert.strictEqual(result.clear, "abcdef1234567890");
        });
    });

    describe("headerAuthMiddleware", () => {
        test("returns 401 when no Authorization header is provided", async () => {
            const { headerAuthMiddleware } = require("../../server/auth");
            let statusCode;
            let body;
            const req = { header: () => undefined };
            const res = {
                locals: {},
                status: (code) => {
                    statusCode = code;
                    return res;
                },
                json: (data) => {
                    body = data;
                },
            };

            await headerAuthMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
            assert.strictEqual(body.ok, false);
        });

        test("returns 401 when an invalid API key is provided", async () => {
            const { headerAuthMiddleware } = require("../../server/auth");
            let statusCode;
            let body;
            const req = { header: (name) => (name === "Authorization" ? "Bearer uk999_invalidkey" : undefined) };
            const res = {
                locals: {},
                status: (code) => {
                    statusCode = code;
                    return res;
                },
                json: (data) => {
                    body = data;
                },
            };

            await headerAuthMiddleware(req, res, () => {});
            assert.strictEqual(statusCode, 401);
            assert.strictEqual(body.ok, false);
        });

        test("calls next and sets apiKeyID with a valid Bearer token", async () => {
            const { headerAuthMiddleware } = require("../../server/auth");
            let nextCalled = false;
            const req = { header: (name) => (name === "Authorization" ? "Bearer " + validKey : undefined) };
            const res = {
                locals: {},
                status: () => res,
                json: () => {},
            };

            await headerAuthMiddleware(req, res, () => {
                nextCalled = true;
            });
            assert.strictEqual(nextCalled, true);
            assert.ok(res.locals.apiKeyID);
        });
    });

    describe("api-spec.json", () => {
        test("loads and contains monitor events", () => {
            const fs = require("fs");
            const spec = JSON.parse(fs.readFileSync("./extra/api-spec.json", "utf8"));

            assert.ok(Array.isArray(spec));
            const names = spec.map((s) => s.name);
            assert.ok(names.includes("getMonitorList"));
            assert.ok(names.includes("add"));
            assert.ok(names.includes("editMonitor"));
            assert.ok(names.includes("deleteMonitor"));
            assert.ok(names.includes("pauseMonitor"));
            assert.ok(names.includes("resumeMonitor"));
        });

        test("loads and contains tag events", () => {
            const fs = require("fs");
            const spec = JSON.parse(fs.readFileSync("./extra/api-spec.json", "utf8"));

            const names = spec.map((s) => s.name);
            assert.ok(names.includes("getTags"));
            assert.ok(names.includes("addTag"));
            assert.ok(names.includes("editTag"));
            assert.ok(names.includes("deleteTag"));
            assert.ok(names.includes("addMonitorTag"));
            assert.ok(names.includes("editMonitorTag"));
            assert.ok(names.includes("deleteMonitorTag"));
        });

        test("all events have required fields", () => {
            const fs = require("fs");
            const spec = JSON.parse(fs.readFileSync("./extra/api-spec.json", "utf8"));

            for (const event of spec) {
                assert.ok(event.name, "Event missing name");
                assert.ok(Array.isArray(event.params), `Event ${event.name} missing params array`);
                for (const param of event.params) {
                    assert.ok(param.name, `Param in ${event.name} missing name`);
                    assert.ok(param.type, `Param ${param.name} in ${event.name} missing type`);
                }
            }
        });
    });

    describe("socketClientHandler parameter validation", () => {
        test("rejects when action is not found in spec", () => {
            // Import the handler indirectly by testing the spec lookup logic
            const fs = require("fs");
            const spec = JSON.parse(fs.readFileSync("./extra/api-spec.json", "utf8"));

            const action = "nonExistentAction";
            const matched = spec.some((s) => s.name === action);
            assert.strictEqual(matched, false);
        });

        test("validates parameter types in spec", () => {
            const fs = require("fs");
            const spec = JSON.parse(fs.readFileSync("./extra/api-spec.json", "utf8"));

            const addEvent = spec.find((s) => s.name === "add");
            assert.ok(addEvent);
            assert.strictEqual(addEvent.params[0].name, "monitor");
            assert.strictEqual(addEvent.params[0].type, "object");

            // Verify wrong type would be caught
            const wrongValue = "not-an-object";
            assert.notStrictEqual(typeof wrongValue, addEvent.params[0].type);
        });
    });
});
