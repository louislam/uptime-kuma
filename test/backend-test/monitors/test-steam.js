process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server" ].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const { UP, PENDING } = require("../../../src/util");
const { SteamMonitorType } = require("../../../server/monitor-types/steam");
const { setSetting } = require("../../../server/util-server");
const TestDB = require("../../mock-testdb");

const testDb = new TestDB();
const TEST_PORT_1 = 30158;
const TEST_PORT_2 = 30159;

describe("Steam Monitor", () => {
    before(async () => {
        await testDb.create();
        await setSetting("steamAPIKey", "test-steam-api-key");
    });

    after(async () => {
        await testDb.destroy();
    });

    test("check() sets status to UP when Steam API returns valid server response", async () => {
        // Create fresh express app for this test
        const app = express();
        app.get("/IGameServersService/GetServerList/v1/", (req, res) => {
            res.json({
                response: {
                    servers: [
                        {
                            name: "Test Game Server",
                            addr: "127.0.0.1:27015"
                        }
                    ]
                }
            });
        });

        const mockServer = await new Promise((resolve) => {
            const server = app.listen(TEST_PORT_1, () => resolve(server));
        });

        try {
            const steamMonitor = new SteamMonitorType();
            steamMonitor.steamApiUrl = `http://127.0.0.1:${TEST_PORT_1}/IGameServersService/GetServerList/v1/`;

            const monitor = {
                hostname: "127.0.0.1",
                port: 27015,
                timeout: 2,
                packetSize: 56,
                ignoreTls: false,
                maxredirects: 10,
                getAcceptedStatuscodes: () => ["200-299"]
            };

            const heartbeat = {
                msg: "",
                status: PENDING,
                ping: null
            };

            await steamMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Test Game Server");
            // Note: ping may be null or a value depending on if ICMP ping succeeds
        } finally {
            await new Promise((resolve) => mockServer.close(resolve));
        }
    });

    test("check() throws error when Steam API returns empty server list", async () => {
        // Create fresh express app for this test
        const app = express();
        app.get("/IGameServersService/GetServerList/v1/", (req, res) => {
            res.json({
                response: {
                    servers: []
                }
            });
        });

        const mockServer = await new Promise((resolve) => {
            const server = app.listen(TEST_PORT_2, () => resolve(server));
        });

        try {
            const steamMonitor = new SteamMonitorType();
            steamMonitor.steamApiUrl = `http://127.0.0.1:${TEST_PORT_2}/IGameServersService/GetServerList/v1/`;

            const monitor = {
                hostname: "127.0.0.1",
                port: 27015,
                timeout: 2,
                ignoreTls: false,
                maxredirects: 10,
                getAcceptedStatuscodes: () => ["200-299"]
            };

            const heartbeat = {
                msg: "",
                status: PENDING
            };

            await assert.rejects(
                steamMonitor.check(monitor, heartbeat, {}),
                {
                    message: "Server not found on Steam"
                }
            );
        } finally {
            await new Promise((resolve) => mockServer.close(resolve));
        }
    });
});
