const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const { GameDigMonitorType } = require("../../../server/monitor-types/gamedig");
const { UP, PENDING } = require("../../../src/util");
const net = require("net");
const { GameDig } = require("gamedig");

describe("GameDig Monitor", () => {
    test("check() sets status to UP when Gamedig.query returns valid server response", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        mock.method(GameDig, "query", async () => {
            return {
                name: "Test Minecraft Server",
                ping: 42,
                players: [],
            };
        });

        const monitor = {
            hostname: "127.0.0.1",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Test Minecraft Server");
            assert.strictEqual(heartbeat.ping, 42);
        } finally {
            mock.restoreAll();
        }
    });

    test("check() resolves hostname to IP address when hostname is not an IP", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        mock.method(GameDig, "query", async (options) => {
            assert.ok(net.isIP(options.host) !== 0, `Expected IP address, got ${options.host}`);
            return {
                name: "Test Server",
                ping: 50,
            };
        });

        const monitor = {
            hostname: "localhost",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "Test Server");
            assert.strictEqual(heartbeat.ping, 50);
        } finally {
            mock.restoreAll();
        }
    });

    test("check() uses IP address directly without DNS resolution when hostname is IPv4", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        mock.method(GameDig, "query", async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "192.168.1.100",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(capturedOptions.host, "192.168.1.100");
            assert.strictEqual(heartbeat.status, UP);
        } finally {
            mock.restoreAll();
        }
    });

    test("check() uses IP address directly without DNS resolution when hostname is IPv6", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        mock.method(GameDig, "query", async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "::1",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(capturedOptions.host, "::1");
            assert.strictEqual(heartbeat.status, UP);
        } finally {
            mock.restoreAll();
        }
    });

    test("check() passes correct parameters to Gamedig.query", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        mock.method(GameDig, "query", async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 25,
            };
        });

        const monitor = {
            hostname: "192.168.1.100",
            port: 27015,
            game: "valve",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(capturedOptions.type, "valve");
            assert.strictEqual(capturedOptions.host, "192.168.1.100");
            assert.strictEqual(capturedOptions.port, 27015);
            assert.strictEqual(capturedOptions.givenPortOnly, true);
        } finally {
            mock.restoreAll();
        }
    });

    test("check() converts gamedigGivenPortOnly to boolean when value is truthy non-boolean", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        let capturedOptions = null;

        mock.method(GameDig, "query", async (options) => {
            capturedOptions = options;
            return {
                name: "Test Server",
                ping: 30,
            };
        });

        const monitor = {
            hostname: "127.0.0.1",
            port: 25565,
            game: "minecraft",
            gamedigGivenPortOnly: 1,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await gamedigMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(capturedOptions.givenPortOnly, true);
            assert.strictEqual(typeof capturedOptions.givenPortOnly, "boolean");
        } finally {
            mock.restoreAll();
        }
    });

    test("check() rejects when game server is unreachable", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        const monitor = {
            hostname: "127.0.0.1",
            port: 54321,
            game: "minecraft",
            gamedigGivenPortOnly: true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(gamedigMonitor.check(monitor, heartbeat, {}), /Error/);
    });

    test("resolveHostname() returns IP address when given valid hostname", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        const resolvedIP = await gamedigMonitor.resolveHostname("localhost");

        assert.ok(net.isIP(resolvedIP) !== 0, `Expected valid IP address, got ${resolvedIP}`);
    });

    test("resolveHostname() rejects when DNS resolution fails for invalid hostname", async () => {
        const gamedigMonitor = new GameDigMonitorType();

        await assert.rejects(
            gamedigMonitor.resolveHostname("this-domain-definitely-does-not-exist-12345.invalid"),
            /DNS resolution failed/
        );
    });
});
