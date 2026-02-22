process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const { UP, PENDING } = require("../../../src/util");
const { SteamMonitorType } = require("../../../server/monitor-types/steam");
const { setSetting } = require("../../../server/util-server");
const TestDB = require("../../mock-testdb");

const testDb = new TestDB();
const TEST_PORT = 30158;
let mockServer;

describe("Steam Monitor", () => {
    before(async () => {
        await testDb.create();
        await setSetting("steamAPIKey", "test-steam-api-key");

        // Create shared mock Steam API server with different endpoints
        const app = express();
        app.use(express.json());
        app.get("/GetServerList/", (req, res) => {
            res.json({
                response: {
                    servers: [
                        {
                            name: "Test Game Server",
                            addr: "127.0.0.1:27015",
                        },
                    ],
                },
            });
        });
        app.get("/EmptyGetServerList/", (req, res) => {
            res.json({
                response: {
                    servers: [],
                },
            });
        });

        mockServer = await new Promise((resolve) => {
            const server = app.listen(TEST_PORT, () => resolve(server));
        });
    });

    after(async () => {
        if (mockServer) {
            await new Promise((resolve) => mockServer.close(resolve));
        }
        await testDb.destroy();
    });

    test("check() sets status to UP when Steam API returns valid server response", async () => {
        const steamMonitor = new SteamMonitorType();
        steamMonitor.steamApiUrl = `http://127.0.0.1:${TEST_PORT}/GetServerList/`;

        const monitor = {
            hostname: "127.0.0.1",
            port: 27015,
            timeout: 2,
            packetSize: 56,
            ignoreTls: false,
            maxredirects: 10,
            getAcceptedStatuscodes: () => ["200-299"],
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
            ping: null,
        };

        await steamMonitor.check(monitor, heartbeat, {});

        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Test Game Server");
        // Note: ping may be null or a value depending on if ICMP ping succeeds
    });

    test("check() throws error when Steam API returns empty server list", async () => {
        const steamMonitor = new SteamMonitorType();
        steamMonitor.steamApiUrl = `http://127.0.0.1:${TEST_PORT}/EmptyGetServerList/`;

        const monitor = {
            hostname: "127.0.0.1",
            port: 27015,
            timeout: 2,
            ignoreTls: false,
            maxredirects: 10,
            getAcceptedStatuscodes: () => ["200-299"],
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(steamMonitor.check(monitor, heartbeat, {}), {
            message: "Server not found on Steam",
        });
    });
});
