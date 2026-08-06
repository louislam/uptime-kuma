const { describe, test } = require("node:test");
const assert = require("node:assert");
const { SteamMonitorType } = require("../../../server/monitor-types/steam");
const { UP, PENDING } = require("../../../src/util");

describe("Steam Monitor", () => {
    test("resolveSteamHostname() returns IP addresses without DNS lookup", async () => {
        let lookupCalled = false;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                lookupCalled = true;
            },
        });

        assert.strictEqual(await steamMonitor.resolveSteamHostname("192.0.2.10"), "192.0.2.10");
        assert.strictEqual(await steamMonitor.resolveSteamHostname("2001:db8::10"), "2001:db8::10");
        assert.strictEqual(lookupCalled, false);
    });

    test("buildServerFilter() resolves hostnames before building the Steam API addr filter", async () => {
        let capturedHostname = null;
        let capturedOptions = null;
        const steamMonitor = new SteamMonitorType({
            lookup: async (hostname, options) => {
                capturedHostname = hostname;
                capturedOptions = options;
                return [
                    {
                        address: "203.0.113.10",
                        family: 4,
                    },
                ];
            },
        });

        const filter = await steamMonitor.buildServerFilter("server.example.com", 27015);

        assert.strictEqual(filter, "addr\\203.0.113.10:27015");
        assert.strictEqual(capturedHostname, "server.example.com");
        assert.deepStrictEqual(capturedOptions, { all: true });
    });

    test("resolveSteamHostname() prefers IPv4 addresses returned by DNS lookup", async () => {
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                return [
                    {
                        address: "2001:db8::20",
                        family: 6,
                    },
                    {
                        address: "203.0.113.20",
                        family: 4,
                    },
                ];
            },
        });

        assert.strictEqual(await steamMonitor.resolveSteamHostname("server.example.com"), "203.0.113.20");
    });

    test("check() uses the resolved IP address in the Steam API filter", async () => {
        let capturedUrl = null;
        let capturedOptions = null;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                return [
                    {
                        address: "203.0.113.30",
                        family: 4,
                    },
                ];
            },
            getSteamAPIKey: async () => "test-steam-api-key",
            steamApiClient: {
                get: async (url, options) => {
                    capturedUrl = url;
                    capturedOptions = options;
                    return {
                        data: {
                            response: {
                                servers: [
                                    {
                                        name: "Test Steam Server",
                                    },
                                ],
                            },
                        },
                    };
                },
            },
            ping: async () => 42,
        });

        const monitor = {
            hostname: "server.example.com",
            port: 27015,
            timeout: 30,
            maxredirects: 10,
            packetSize: 56,
            getIgnoreTls: () => false,
            getAcceptedStatuscodes: () => ["200"],
        };
        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await steamMonitor.check(monitor, heartbeat);

        assert.strictEqual(capturedUrl, "https://api.steampowered.com/IGameServersService/GetServerList/v1/");
        assert.strictEqual(capturedOptions.params.filter, "addr\\203.0.113.30:27015");
        assert.strictEqual(capturedOptions.params.key, "test-steam-api-key");
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Test Steam Server");
        assert.strictEqual(heartbeat.ping, 42);
    });

    test("check() does not resolve hostnames when the Steam API key is missing", async () => {
        let lookupCalled = false;
        const steamMonitor = new SteamMonitorType({
            lookup: async () => {
                lookupCalled = true;
            },
            getSteamAPIKey: async () => "",
        });

        const monitor = {
            hostname: "server.example.com",
            port: 27015,
        };
        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(steamMonitor.check(monitor, heartbeat), /Steam API Key not found/);
        assert.strictEqual(lookupCalled, false);
    });
});
