const { describe, test } = require("node:test");
const assert = require("node:assert");
const { HiveMQContainer } = require("@testcontainers/hivemq");
const mqtt = require("mqtt");
const { MqttMonitorType } = require("../../server/monitor-types/mqtt");
const { UP, PENDING } = require("../../src/util");

/**
 * Runs an MQTT test with the
 * @param  {string} mqttSuccessMessage the message that the monitor expects
 * @param {null|"keyword"|"json-query"} mqttCheckType the type of check we perform
 * @param {string} receivedMessage what message is received from the mqtt channel
 * @returns {Promise<Heartbeat>} the heartbeat produced by the check
 */
async function testMqtt(mqttSuccessMessage, mqttCheckType, receivedMessage) {
    const hiveMQContainer = await new HiveMQContainer().start();
    const connectionString = hiveMQContainer.getConnectionString();
    const mqttMonitorType = new MqttMonitorType();
    const monitor = {
        jsonPath: "firstProp", // always return firstProp for the json-query monitor
        hostname: connectionString.split(":", 2).join(":"),
        mqttTopic: "test",
        port: connectionString.split(":")[2],
        mqttUsername: null,
        mqttPassword: null,
        mqttWebsocketPath: null, // for WebSocket connections
        interval: 20, // controls the timeout
        mqttSuccessMessage: mqttSuccessMessage, // for keywords
        expectedValue: mqttSuccessMessage, // for json-query
        mqttCheckType: mqttCheckType,
    };
    const heartbeat = {
        msg: "",
        status: PENDING,
    };

    const testMqttClient = mqtt.connect(hiveMQContainer.getConnectionString());
    testMqttClient.on("connect", () => {
        testMqttClient.subscribe("test", (error) => {
            if (!error) {
                testMqttClient.publish("test", receivedMessage);
            }
        });
    });

    try {
        await mqttMonitorType.check(monitor, heartbeat, {});
    } finally {
        testMqttClient.end();
        hiveMQContainer.stop();
    }
    return heartbeat;
}

describe("MqttMonitorType", {
    concurrency: true,
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")
}, () => {
    test("valid keywords (type=default)", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
    });

    test("valid keywords (type=keyword)", async () => {
        const heartbeat = await testMqtt("KEYWORD", "keyword", "-> KEYWORD <-");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
    });
    test("invalid keywords (type=default)", async () => {
        await assert.rejects(
            testMqtt("NOT_PRESENT", null, "-> KEYWORD <-"),
            new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-"),
        );
    });

    test("invalid keyword (type=keyword)", async () => {
        await assert.rejects(
            testMqtt("NOT_PRESENT", "keyword", "-> KEYWORD <-"),
            new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-"),
        );
    });
    test("valid json-query", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        const heartbeat = await testMqtt("present", "json-query", "{\"firstProp\":\"present\"}");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Message received, expected value is found");
    });
    test("invalid (because query fails) json-query", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        await assert.rejects(
            testMqtt("[not_relevant]", "json-query", "{}"),
            new Error("Message received but value is not equal to expected value, value was: [undefined]"),
        );
    });
    test("invalid (because successMessage fails) json-query", async () => {
        // works because the monitors' jsonPath is hard-coded to "firstProp"
        await assert.rejects(
            testMqtt("[wrong_success_messsage]", "json-query", "{\"firstProp\":\"present\"}"),
            new Error("Message received but value is not equal to expected value, value was: [present]")
        );
    });
});
