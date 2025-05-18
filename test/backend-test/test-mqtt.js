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
 * @param {string} monitorTopic which MQTT topic is monitored (wildcards are allowed)
 * @param {string} publishTopic to which MQTT topic the message is sent
 * @returns {Promise<Heartbeat>} the heartbeat produced by the check
 */
async function testMqtt(mqttSuccessMessage, mqttCheckType, receivedMessage, monitorTopic = "test", publishTopic = "test") {
    const hiveMQContainer = await new HiveMQContainer().start();
    const connectionString = hiveMQContainer.getConnectionString();
    const mqttMonitorType = new MqttMonitorType();
    const monitor = {
        jsonPath: "firstProp", // always return firstProp for the json-query monitor
        hostname: connectionString.split(":", 2).join(":"),
        mqttTopic: monitorTopic,
        port: connectionString.split(":")[2],
        mqttUsername: null,
        mqttPassword: null,
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
        testMqttClient.subscribe(monitorTopic, (error) => {
            if (!error) {
                testMqttClient.publish(publishTopic, receivedMessage);
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
    concurrency: 4,
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")
}, () => {
    test("valid keywords (type=default)", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
    });

    test("valid nested topic", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/b/c", "a/b/c");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
    });

    test("valid wildcard topic (with #)", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/#", "a/b/c");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
    });

    test("valid wildcard topic (with +)", async () => {
        const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/+/c", "a/b/c");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
    });

    test("invalid topic", async () => {
        await assert.rejects(
            testMqtt("keyword will not be checked anyway", null, "message", "x/y/z", "a/b/c"),
            new Error("Timeout, Message not received"),
        );
    });

    test("invalid wildcard topic (with #)", async () => {
        await assert.rejects(
            testMqtt("", null, "# should be last character", "#/c", "a/b/c"),
            new Error("Timeout, Message not received"),
        );
    });

    test("invalid wildcard topic (with +)", async () => {
        await assert.rejects(
            testMqtt("", null, "message", "x/+/z", "a/b/c"),
            new Error("Timeout, Message not received"),
        );
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
