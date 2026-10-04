const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const dgram = require("dgram");
const radius = require("radius");
const { radius: radiusCheck } = require("../../server/util-server");

/**
 * Start a UDP RADIUS server that replies to every Access-Request with the given response code.
 * @param {string} secret RADIUS shared secret
 * @param {string} responseCode RADIUS response code to send back
 * @returns {Promise<{socket: import("dgram").Socket, port: number, address: string}>} The bound UDP socket and its address
 */
function startRadiusServer(secret, responseCode) {
    const socket = dgram.createSocket("udp4");

    socket.on("message", (msg, rinfo) => {
        try {
            const request = radius.decode({ packet: msg, secret });
            const response = radius.encode_response({
                packet: request,
                code: responseCode,
                secret,
            });
            socket.send(response, 0, response.length, rinfo.port, rinfo.address, () => {});
        } catch (error) {
            // Ignore decode errors, the client will time out
        }
    });

    return new Promise((resolve) => {
        socket.on("listening", () => {
            const { address, port } = socket.address();
            resolve({ socket, port, address });
        });
        socket.bind(0, "127.0.0.1");
    });
}

describe("RadiusMonitorType", () => {
    const secret = "testing123";

    test("radius() resolves with code Access-Challenge when server responds with Access-Challenge", async () => {
        const { socket, port } = await startRadiusServer(secret, "Access-Challenge");

        try {
            const resp = await radiusCheck("127.0.0.1", "bob", "testpw", "called", "calling", secret, port, 2000);
            assert.strictEqual(resp.code, "Access-Challenge");
        } finally {
            socket.close();
        }
    });

    test("radius() rejects when server responds with Access-Reject", async () => {
        const { socket, port } = await startRadiusServer(secret, "Access-Reject");

        try {
            await assert.rejects(
                radiusCheck("127.0.0.1", "bob", "testpw", "called", "calling", secret, port, 2000),
                /RADIUS Access-Reject from 127\.0\.0\.1:/
            );
        } finally {
            socket.close();
        }
    });

    test("radius() resolves with code Access-Accept when server responds with Access-Accept", async () => {
        const { socket, port } = await startRadiusServer(secret, "Access-Accept");

        try {
            const resp = await radiusCheck("127.0.0.1", "bob", "testpw", "called", "calling", secret, port, 2000);
            assert.strictEqual(resp.code, "Access-Accept");
        } finally {
            socket.close();
        }
    });
});
