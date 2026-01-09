const { describe, test } = require("node:test");
const assert = require("node:assert");
const { HiveMQContainer } = require("@testcontainers/hivemq");
const mqtt = require("mqtt");
const { MqttMonitorType } = require("../../../server/monitor-types/mqtt");
const { UP, PENDING } = require("../../../src/util");

/**
 * Runs an MQTT test with the
 * @param  {string} mqttSuccessMessage the message that the monitor expects
 * @param {null|"keyword"|"json-query"} mqttCheckType the type of check we perform
 * @param {string} receivedMessage what message is received from the mqtt channel
 * @param {string} monitorTopic which MQTT topic is monitored (wildcards are allowed)
 * @param {string} publishTopic to which MQTT topic the message is sent
 * @param {string|null} conditions JSON string of conditions or null
 * @returns {Promise<Heartbeat>} the heartbeat produced by the check
 */
async function testMqtt(
    mqttSuccessMessage,
    mqttCheckType,
    receivedMessage,
    monitorTopic = "test",
    publishTopic = "test",
    conditions = null
) {
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
        mqttWebsocketPath: null, // for WebSocket connections
        interval: 20, // controls the timeout
        mqttSuccessMessage: mqttSuccessMessage, // for keywords
        expectedValue: mqttSuccessMessage, // for json-query
        mqttCheckType: mqttCheckType,
        conditions: conditions, // for conditions system
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

describe(
    "MqttMonitorType",
    {
        concurrency: 4,
        skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
    },
    () => {
        test("check() sets status to UP when keyword is found in message (type=default)", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when keyword is found in nested topic", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/b/c", "a/b/c");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when keyword is found in nested topic with special characters", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/'/$/./*/%", "a/'/$/./*/%");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: a/'/$/./*/%; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when keyword is found using # wildcard", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/#", "a/b/c");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when keyword is found using + wildcard", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/+/c", "a/b/c");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: a/b/c; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when keyword is found using + and # wildcards", async () => {
            const heartbeat = await testMqtt("KEYWORD", null, "-> KEYWORD <-", "a/+/c/#", "a/b/c/d/e");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: a/b/c/d/e; Message: -> KEYWORD <-");
        });

        test("check() rejects with timeout when topic does not match", async () => {
            await assert.rejects(
                testMqtt("keyword will not be checked anyway", null, "message", "x/y/z", "a/b/c"),
                new Error("Timeout, Message not received")
            );
        });

        test("check() rejects with timeout when # wildcard is not last character", async () => {
            await assert.rejects(
                testMqtt("", null, "# should be last character", "#/c", "a/b/c"),
                new Error("Timeout, Message not received")
            );
        });

        test("check() rejects with timeout when + wildcard topic does not match", async () => {
            await assert.rejects(
                testMqtt("", null, "message", "x/+/z", "a/b/c"),
                new Error("Timeout, Message not received")
            );
        });

        test("check() sets status to UP when keyword is found in message (type=keyword)", async () => {
            const heartbeat = await testMqtt("KEYWORD", "keyword", "-> KEYWORD <-");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
        });

        test("check() rejects when keyword is not found in message (type=default)", async () => {
            await assert.rejects(
                testMqtt("NOT_PRESENT", null, "-> KEYWORD <-"),
                new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-")
            );
        });

        test("check() rejects when keyword is not found in message (type=keyword)", async () => {
            await assert.rejects(
                testMqtt("NOT_PRESENT", "keyword", "-> KEYWORD <-"),
                new Error("Message Mismatch - Topic: test; Message: -> KEYWORD <-")
            );
        });

        test("check() sets status to UP when json-query finds expected value", async () => {
            // works because the monitors' jsonPath is hard-coded to "firstProp"
            const heartbeat = await testMqtt("present", "json-query", '{"firstProp":"present"}');
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Message received, expected value is found");
        });

        test("check() rejects when json-query path returns undefined", async () => {
            // works because the monitors' jsonPath is hard-coded to "firstProp"
            await assert.rejects(
                testMqtt("[not_relevant]", "json-query", "{}"),
                new Error("Message received but value is not equal to expected value, value was: [undefined]")
            );
        });

        test("check() rejects when json-query value does not match expected value", async () => {
            // works because the monitors' jsonPath is hard-coded to "firstProp"
            await assert.rejects(
                testMqtt("[wrong_success_messsage]", "json-query", '{"firstProp":"present"}'),
                new Error("Message received but value is not equal to expected value, value was: [present]")
            );
        });

        // Conditions system tests
        test("check() sets status to UP when message condition matches (contains)", async () => {
            const conditions = JSON.stringify([
                {
                    type: "expression",
                    variable: "message",
                    operator: "contains",
                    value: "KEYWORD",
                },
            ]);
            const heartbeat = await testMqtt("", null, "-> KEYWORD <-", "test", "test", conditions);
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Topic: test; Message: -> KEYWORD <-");
        });

        test("check() sets status to UP when topic condition matches (equals)", async () => {
            const conditions = JSON.stringify([
                {
                    type: "expression",
                    variable: "topic",
                    operator: "equals",
                    value: "sensors/temp",
                },
            ]);
            const heartbeat = await testMqtt("", null, "any message", "sensors/temp", "sensors/temp", conditions);
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() rejects when message condition does not match", async () => {
            const conditions = JSON.stringify([
                {
                    type: "expression",
                    variable: "message",
                    operator: "contains",
                    value: "EXPECTED",
                },
            ]);
            await assert.rejects(
                testMqtt("", null, "actual message without keyword", "test", "test", conditions),
                new Error("Conditions not met - Topic: test; Message: actual message without keyword")
            );
        });

        test("check() sets status to UP with multiple conditions (AND)", async () => {
            const conditions = JSON.stringify([
                {
                    type: "expression",
                    variable: "topic",
                    operator: "equals",
                    value: "test",
                },
                {
                    type: "expression",
                    variable: "message",
                    operator: "contains",
                    value: "success",
                    andOr: "and",
                },
            ]);
            const heartbeat = await testMqtt("", null, "operation success", "test", "test", conditions);
            assert.strictEqual(heartbeat.status, UP);
        });
    }
);
