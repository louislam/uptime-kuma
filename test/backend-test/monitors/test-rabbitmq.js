const { describe, test } = require("node:test");
const assert = require("node:assert");
const { RabbitMQContainer } = require("@testcontainers/rabbitmq");
const { RabbitMqMonitorType } = require("../../../server/monitor-types/rabbitmq");
const { UP, PENDING } = require("../../../src/util");

describe("RabbitMQ Single Node", {
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
}, () => {
    test("check() sets status to UP when RabbitMQ server is reachable", async () => {
        // The default timeout of 30 seconds might not be enough for the container to start
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const connectionString = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

        const monitor = {
            rabbitmqNodes: JSON.stringify([ connectionString ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
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

    test("check() rejects when RabbitMQ server is not reachable", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([ "http://localhost:15672" ]),
            rabbitmqUsername: "rabbitmqUser",
            rabbitmqPassword: "rabbitmqPass",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        // regex match any string
        const regex = /.+/;

        await assert.rejects(
            rabbitMQMonitor.check(monitor, heartbeat, {}),
            regex
        );
    });

    test("checkSingleNode() sets status to UP when node is healthy", async () => {
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const connectionString = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

        const monitor = {
            name: "Test Monitor",
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await rabbitMQMonitor.checkSingleNode(monitor, heartbeat, connectionString, 1, 1);
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "OK");
        } finally {
            rabbitMQContainer.stop();
        }
    });

    test("checkSingleNode() throws error when node is unreachable", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            name: "Test Monitor",
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            rabbitMQMonitor.checkSingleNode(monitor, heartbeat, "http://localhost:15672", 1, 1),
            /connect ECONNREFUSED/
        );
    });
});

describe("RabbitMQ Multi-Node", {
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
}, () => {
    test("check() succeeds when first node is healthy", async () => {
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const healthyNode = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;
        const unhealthyNode = "http://localhost:15673";

        const monitor = {
            rabbitmqNodes: JSON.stringify([ healthyNode, unhealthyNode ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
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

    test("check() succeeds when second node is healthy after first fails", async () => {
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const unhealthyNode = "http://localhost:15673";
        const healthyNode = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`;

        const monitor = {
            rabbitmqNodes: JSON.stringify([ unhealthyNode, healthyNode ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
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

    test("check() fails with consolidated error when all nodes are down", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([
                "http://localhost:15673",
                "http://localhost:15674",
                "http://localhost:15675"
            ]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            rabbitMQMonitor.check(monitor, heartbeat, {}),
            (error) => {
                assert.match(error.message, /All 3 nodes failed/);
                assert.match(error.message, /Node 1:/);
                assert.match(error.message, /Node 2:/);
                assert.match(error.message, /Node 3:/);
                return true;
            }
        );
    });

    test("check() fails when no nodes are configured", async () => {
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const monitor = {
            rabbitmqNodes: JSON.stringify([]),
            rabbitmqUsername: "guest",
            rabbitmqPassword: "guest",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            rabbitMQMonitor.check(monitor, heartbeat, {}),
            /No RabbitMQ nodes configured/
        );
    });

    test("check() handles mix of connection errors and service errors", async () => {
        const rabbitMQContainer = await new RabbitMQContainer().withStartupTimeout(60000).start();
        const rabbitMQMonitor = new RabbitMqMonitorType();
        const connectionErrorNode = "http://localhost:15673"; // Connection refused
        const authErrorNode = `http://${rabbitMQContainer.getHost()}:${rabbitMQContainer.getMappedPort(15672)}`; // Wrong credentials
        
        const monitor = {
            rabbitmqNodes: JSON.stringify([ connectionErrorNode, authErrorNode ]),
            rabbitmqUsername: "wronguser",
            rabbitmqPassword: "wrongpass",
            timeout: 10,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await assert.rejects(
                rabbitMQMonitor.check(monitor, heartbeat, {}),
                (error) => {
                    assert.match(error.message, /All 2 nodes failed/);
                    return true;
                }
            );
        } finally {
            rabbitMQContainer.stop();
        }
    });
});
