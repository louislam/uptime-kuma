const { describe, test } = require("node:test");
const assert = require("node:assert");
const { kafkaProducerAsync } = require("../../../server/util-server");

describe("Kafka Producer", () => {
    test("rejects when broker is not reachable", async () => {
        await assert.rejects(
            kafkaProducerAsync(["localhost:19092"], "test-topic", "test-message", {
                interval: 5,
                connectionTimeout: 1,
            }),
            /.*/ // any error
        );
    });
});
