const { describe, test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

const {
    RETRYABLE_NOTIFICATION_ERROR_CODES,
    isRetryableNotificationError,
    sendNotificationWithRetry,
} = require("../../server/notification-retry");

const Teams = require("../../server/notification-providers/teams");
const teams = new Teams();

/**
 * Grabs an OS-assigned port and releases it again, for use as "a free port
 * that nothing is listening on yet".
 * @returns {Promise<number>} A free TCP port
 */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.once("error", reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

describe("isRetryableNotificationError()", () => {
    for (let code of RETRYABLE_NOTIFICATION_ERROR_CODES) {
        test(`retries ${code} via error.code`, () => {
            let error = new Error(`connect ${code} 1.2.3.4:443`);
            error.code = code;
            assert.strictEqual(isRetryableNotificationError(error), true);
        });

        test(`retries ${code} via a wrapped message`, () => {
            let error = new Error(`connect ${code} 1.2.3.4:443 (code=${code})`);
            assert.strictEqual(isRetryableNotificationError(error), true);
        });
    }

    test("does not retry ENOTFOUND", () => {
        let error = new Error("getaddrinfo ENOTFOUND example.invalid");
        error.code = "ENOTFOUND";
        assert.strictEqual(isRetryableNotificationError(error), false);
    });

    test("does not retry a plain Error", () => {
        assert.strictEqual(isRetryableNotificationError(new Error("boom")), false);
    });

    test("does not retry an HTTP 500 message", () => {
        let error = new Error("Request failed (HTTP 500 Internal Server Error)");
        assert.strictEqual(isRetryableNotificationError(error), false);
    });

    test("does not retry an HTTP 429 message", () => {
        let error = new Error("Request failed (HTTP 429 Too Many Requests)");
        assert.strictEqual(isRetryableNotificationError(error), false);
    });

    test("does not retry when error.httpStatus is set", () => {
        let error = new Error("connect ECONNREFUSED 1.2.3.4:443 (code=ECONNREFUSED)");
        error.httpStatus = 500;
        assert.strictEqual(isRetryableNotificationError(error), false);
    });

    test("retries an AggregateError whose causes include ECONNREFUSED", () => {
        let subError = new Error("connect ECONNREFUSED 127.0.0.1:443");
        subError.code = "ECONNREFUSED";
        let aggregateError = new AggregateError([subError], "AggregateError");
        assert.strictEqual(isRetryableNotificationError(aggregateError), true);
    });
});

describe("sendNotificationWithRetry()", () => {
    test("succeeds on the 2nd attempt", async () => {
        let calls = 0;
        let sendFn = async () => {
            calls++;
            if (calls === 1) {
                let error = new Error("connect ECONNREFUSED 127.0.0.1:443");
                error.code = "ECONNREFUSED";
                throw error;
            }
        };

        let result = await sendNotificationWithRetry(sendFn, { delaysMs: [1, 1] });
        assert.strictEqual(result.attempts, 2);
        assert.strictEqual(calls, 2);
    });

    test("does not retry an HTTP 500 (sendFn called exactly once)", async () => {
        let calls = 0;
        let sendFn = async () => {
            calls++;
            let error = new Error("Request failed (HTTP 500 Internal Server Error)");
            error.httpStatus = 500;
            throw error;
        };

        await assert.rejects(() => sendNotificationWithRetry(sendFn, { delaysMs: [1, 1] }), /HTTP 500/);
        assert.strictEqual(calls, 1);
    });

    test("exhausts all 3 attempts and rethrows the last error", async () => {
        let calls = 0;
        let sendFn = async () => {
            calls++;
            let error = new Error(`connect ETIMEDOUT 1.2.3.4:443 (attempt ${calls}) (code=ETIMEDOUT)`);
            error.code = "ETIMEDOUT";
            throw error;
        };

        await assert.rejects(
            () => sendNotificationWithRetry(sendFn, { delaysMs: [1, 1] }),
            (error) => {
                assert.match(error.message, /attempt 3/);
                return true;
            }
        );
        assert.strictEqual(calls, 3);
    });

    test("honours onRetry, called with attempt 1 and 2", async () => {
        let retries = [];
        let sendFn = async () => {
            let error = new Error("connect ECONNRESET 1.2.3.4:443");
            error.code = "ECONNRESET";
            throw error;
        };

        await assert.rejects(() =>
            sendNotificationWithRetry(sendFn, {
                delaysMs: [1, 1],
                onRetry: (info) => retries.push(info),
            })
        );

        assert.strictEqual(retries.length, 2);
        assert.strictEqual(retries[0].attempt, 1);
        assert.strictEqual(retries[1].attempt, 2);
        assert.strictEqual(retries[0].delayMs, 1);
        assert.strictEqual(retries[1].delayMs, 1);
    });
});

describe("sendNotificationWithRetry() integration with the real teams provider", () => {
    test("a real unreachable endpoint is retryable and recovers on the next attempt", async () => {
        let port = await getFreePort();
        let notification = { webhookUrl: `http://127.0.0.1:${port}/webhook` };

        // Nothing is listening on this port yet: the real provider must throw a
        // retryable error (no mocks involved). Keep the genuine error around, so the
        // retry below is driven by an error object the real provider produced.
        let transportError;
        await assert.rejects(
            () => teams.send(notification, "test", null, null),
            (error) => {
                transportError = error;
                assert.strictEqual(isRetryableNotificationError(error), true);
                return true;
            }
        );

        let receivedRequests = 0;
        let okServer = http.createServer((req, res) => {
            if (req.method === "POST") {
                receivedRequests++;
            }
            res.statusCode = 200;
            res.end("ok");
        });

        try {
            await new Promise((resolve, reject) => {
                okServer.once("error", reject);
                okServer.listen(port, resolve);
            });

            // The endpoint is reachable again now: attempt 1 replays the real
            // transport error, attempt 2 is a real HTTP POST to the real provider.
            let calls = 0;
            let result = await sendNotificationWithRetry(
                async () => {
                    calls++;
                    if (calls === 1) {
                        throw transportError;
                    }
                    await teams.send(notification, "test", null, null);
                },
                { delaysMs: [5, 5] }
            );

            assert.strictEqual(result.attempts, 2);
            assert.strictEqual(calls, 2);
            assert.strictEqual(receivedRequests, 1);
        } finally {
            await new Promise((resolve) => okServer.close(resolve));
        }
    });

    test("a real HTTP 500 response is never retried", async () => {
        let receivedRequests = 0;
        let errorServer = http.createServer((req, res) => {
            receivedRequests++;
            res.statusCode = 500;
            res.end("boom");
        });

        try {
            await new Promise((resolve, reject) => {
                errorServer.once("error", reject);
                errorServer.listen(0, resolve);
            });
            let port = errorServer.address().port;
            let notification = { webhookUrl: `http://127.0.0.1:${port}/webhook` };

            await assert.rejects(() =>
                sendNotificationWithRetry(() => teams.send(notification, "test", null, null), {
                    delaysMs: [5, 5],
                })
            );

            assert.strictEqual(receivedRequests, 1);
        } finally {
            await new Promise((resolve) => errorServer.close(resolve));
        }
    });
});
