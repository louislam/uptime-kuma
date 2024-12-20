const { describe, test } = require("node:test");
const assert = require("node:assert");
const { HiveMQContainer } = require("@testcontainers/hivemq");
const mqtt = require("mqtt");
const { MqttMonitorType } = require("../../server/monitor-types/mqtt");
const { UP, DOWN, PENDING } = require("../../src/util");

/**
 * Runs an MQTT test with the given parameters
 * @param {object} options Test configuration options
 * @param {string} options.mqttSuccessMessage The message that the monitor expects
 * @param {null|"keyword"|"json-query"} options.mqttCheckType The type of check to perform
 * @param {string} options.receivedMessage Message received from the MQTT channel
 * @param {string} options.jsonPath JSON path for json-query checks
 * @param {string} options.topic MQTT topic to subscribe to
 * @param {number} options.interval Monitor check interval
 * @param {string} options.username MQTT username
 * @param {string} options.password MQTT password
 * @returns {Promise<heartbeat>} The heartbeat produced by the check
 */
async function testMqtt({
    mqttSuccessMessage,
    mqttCheckType,
    receivedMessage,
    jsonPath = "firstProp",
    topic = "test",
    interval = 20,
    username = null,
    password = null
}) {
    const hiveMQContainer = await new HiveMQContainer().start();
    const connectionString = hiveMQContainer.getConnectionString();
    const mqttMonitorType = new MqttMonitorType();

    const monitor = {
        jsonPath,
        hostname: connectionString.split(":", 2).join(":"),
        mqttTopic: topic,
        port: connectionString.split(":")[2],
        mqttUsername: username,
        mqttPassword: password,
        interval,
        mqttSuccessMessage,
        expectedValue: mqttSuccessMessage,
        mqttCheckType,
    };

    const heartbeat = {
        msg: "",
        status: PENDING,
    };

    const testMqttClient = mqtt.connect(hiveMQContainer.getConnectionString(), {
        username,
        password
    });

    testMqttClient.on("connect", () => {
        testMqttClient.subscribe(topic, (error) => {
            if (!error) {
                testMqttClient.publish(topic, receivedMessage);
            }
        });
    });

    try {
        await mqttMonitorType.check(monitor, heartbeat, {});
    } finally {
        testMqttClient.end();
        await hiveMQContainer.stop();
    }
    return heartbeat;
}

describe("MqttMonitorType", {
    concurrency: true,
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")
}, () => {
    describe("Keyword Matching Tests", () => {
        test("should match exact keyword (type=default)", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "KEYWORD",
                mqttCheckType: null,
                receivedMessage: "KEYWORD"
            });
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: test; Message: KEYWORD");
        });

        test("should match keyword within message (type=default)", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "KEYWORD",
                mqttCheckType: null,
                receivedMessage: "-> KEYWORD <-"
            });
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
        });

        test("should fail on missing keyword (type=default)", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "NOT_PRESENT",
                    mqttCheckType: null,
                    receivedMessage: "-> KEYWORD <-"
                }),
                new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-")
            );
        });

        test("should handle special characters in keyword", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "特殊文字",
                mqttCheckType: "keyword",
                receivedMessage: "Message: 特殊文字"
            });
            assert.strictEqual(heartbeat.status, UP);
        });
    });

    describe("JSON Query Tests", () => {
        test("should match simple JSON value", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "present",
                mqttCheckType: "json-query",
                receivedMessage: "{\"firstProp\":\"present\"}"
            });
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Message received, expected value is found");
        });

        test("should handle nested JSON paths", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "nested-value",
                mqttCheckType: "json-query",
                receivedMessage: "{\"parent\":{\"firstProp\":\"nested-value\"}}",
                jsonPath: "parent.firstProp"
            });
            assert.strictEqual(heartbeat.status, UP);
        });

        test("should fail on missing JSON path", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "value",
                    mqttCheckType: "json-query",
                    receivedMessage: "{}",
                    jsonPath: "nonexistent"
                }),
                /Message received but value is not equal to expected value/
            );
        });

        test("should fail on invalid JSON", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "value",
                    mqttCheckType: "json-query",
                    receivedMessage: "invalid-json"
                }),
                /Unexpected token/
            );
        });

        test("should handle array values", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "item2",
                mqttCheckType: "json-query",
                receivedMessage: "{\"firstProp\":[\"item1\",\"item2\",\"item3\"]}",
                jsonPath: "firstProp[1]"
            });
            assert.strictEqual(heartbeat.status, UP);
        });
    });

    describe("Authentication Tests", () => {
        test("should handle successful authentication", async () => {
            const heartbeat = await testMqtt({
                mqttSuccessMessage: "auth-success",
                mqttCheckType: "keyword",
                receivedMessage: "auth-success",
                username: "testuser",
                password: "testpass"
            });
            assert.strictEqual(heartbeat.status, UP);
        });

        test("should handle failed authentication", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "irrelevant",
                    mqttCheckType: "keyword",
                    receivedMessage: "irrelevant",
                    username: "invalid",
                    password: "invalid"
                }),
                /Authentication failed/
            );
        });
    });

    describe("Error Handling Tests", () => {
        test("should handle connection timeout", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "timeout",
                    mqttCheckType: "keyword",
                    receivedMessage: "timeout",
                    interval: 1
                }),
                /Timeout/
            );
        });

        test("should handle invalid topic format", async () => {
            await assert.rejects(
                testMqtt({
                    mqttSuccessMessage: "invalid",
                    mqttCheckType: "keyword",
                    receivedMessage: "invalid",
                    topic: "invalid/#/topic"
                }),
                /Invalid topic/
            );
        });

        test("should handle disconnection", async () => {
            const hiveMQContainer = await new HiveMQContainer().start();
            const heartbeat = { status: PENDING,
                msg: "" };
            const monitor = new MqttMonitorType();

            try {
                await hiveMQContainer.stop();
                await monitor.check({
                    hostname: hiveMQContainer.getConnectionString().split(":")[0],
                    port: hiveMQContainer.getConnectionString().split(":")[2],
                    mqttTopic: "test"
                }, heartbeat, {});
                assert.fail("Should have thrown an error");
            } catch (error) {
                assert.ok(error.message.includes("connect"));
            }
        });
    });
});
