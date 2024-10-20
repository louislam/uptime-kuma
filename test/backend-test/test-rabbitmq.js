const { describe, test } = require("node:test");
const assert = require("node:assert");
const { RabbitMQContainer } = require("@testcontainers/rabbitmq");
const { RabbitMqMonitorType } = require("../../server/monitor-types/rabbitmq");
const { UP, DOWN, PENDING } = require("../../src/util");

describe("RabbitMQ Single Node", {
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
}, () => {
    test("RabbitMQ is running", async () => {
        // The default timeout of 30 seconds might not be enough for the container to start
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const connectionString = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

        const monitor = {
            rabbitmqNodes: JSON.stringify([ connectionString ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await rabbitMQMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "OK");
        } finally {
            rabbitMQContainer.stop();
        }
    });

    test("RabbitMQ is not running", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([ "http://localhost:15672" ]),
            rabbitmqUsername: "rabbitmqUser",
            rabbitmqPassword: "rabbitmqPass",
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await rabbitMQMonitor.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, DOWN);
    });

});
