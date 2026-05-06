const { describe, test, mock, afterEach } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");
const { SyncthingMonitorType } = require("../../../server/monitor-types/syncthing");
const { UP } = require("../../../src/util");

const monitorType = new SyncthingMonitorType();

const LOCAL_ID = "AAAAAAA-AAAAAAA-AAAAAAA-AAAAAAA-AAAAAAA-AAAAAAA-AAAAAAA-AAAAAAA";
const DEVICE_B = "BBBBBBB-BBBBBBB-BBBBBBB-BBBBBBB-BBBBBBB-BBBBBBB-BBBBBBB-BBBBBBB";
const DEVICE_C = "CCCCCCC-CCCCCCC-CCCCCCC-CCCCCCC-CCCCCCC-CCCCCCC-CCCCCCC-CCCCCCC";
const DEVICE_D = "DDDDDDD-DDDDDDD-DDDDDDD-DDDDDDD-DDDDDDD-DDDDDDD-DDDDDDD-DDDDDDD";

const NOW = new Date().toISOString();
const ONE_HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const TWO_DAYS_AGO = new Date(Date.now() - 172_800_000).toISOString();

/**
 * Build a minimal monitor config object.
 * @param {object} overrides Properties to override on the default config
 * @returns {object} Monitor config
 */
function makeMonitor(overrides = {}) {
    return {
        syncthingUrl: "http://localhost:8384",
        syncthingApiKey: "test-key",
        syncthingCheckType: "health",
        syncthingFilter: "",
        syncthingFilterMode: "exclude",
        syncthingPeerTimeout: 86400,
        syncthingFolderSyncThreshold: 0,
        ignoreTls: false,
        timeout: 5,
        ...overrides,
    };
}

/**
 * Build a fresh heartbeat object.
 * @returns {object} Heartbeat with null/empty fields
 */
function makeHeartbeat() {
    return { status: null, msg: "", ping: null };
}

/**
 * Build a default API state and return a mock axios.get function.
 * @param {object} overrides Deep-merged into the default state
 * @returns {Function} Mock for axios.get
 */
function makeAxiosMock(overrides = {}) {
    const state = {
        systemStatus: { myID: LOCAL_ID },
        systemError: { errors: null },
        systemConfig: {
            folders: [
                { id: "photos", label: "Photos", paused: false },
                { id: "docs", label: "Docs", paused: false },
                { id: "backup", label: "Backup", paused: true },
            ],
            devices: [
                { deviceID: LOCAL_ID, name: "LocalNode" },
                { deviceID: DEVICE_B, name: "ServerB" },
                { deviceID: DEVICE_C, name: "Laptop" },
                { deviceID: DEVICE_D, name: "NAS" },
            ],
        },
        dbStatus: {
            photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
            docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
            backup: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
        },
        systemConnections: {
            connections: {
                [DEVICE_B]: { connected: true, paused: false },
                [DEVICE_C]: { connected: false, paused: false },
                [DEVICE_D]: { connected: false, paused: true },
            },
        },
        statsDevice: {
            [DEVICE_B]: { lastSeen: NOW },
            [DEVICE_C]: { lastSeen: ONE_HOUR_AGO },
            [DEVICE_D]: { lastSeen: TWO_DAYS_AGO },
        },
        ...overrides,
    };

    return async (url) => {
        const path = url.replace(/^https?:\/\/[^/]+\/rest\//, "");
        const basePath = path.split("?")[0];
        const params = new URLSearchParams(path.split("?")[1] || "");

        if (basePath === "system/status") {
            return { data: state.systemStatus };
        }
        if (basePath === "system/error") {
            return { data: state.systemError };
        }
        if (basePath === "system/config") {
            return { data: state.systemConfig };
        }
        if (basePath === "system/connections") {
            return { data: state.systemConnections };
        }
        if (basePath === "stats/device") {
            return { data: state.statsDevice };
        }
        if (basePath === "db/status") {
            const folder = params.get("folder");
            return { data: state.dbStatus[folder] ?? { state: "idle", stateChanged: NOW, errors: 0, needBytes: 0 } };
        }

        throw new Error(`Unexpected URL: ${url}`);
    };
}

describe("SyncthingMonitorType - health", () => {
    afterEach(() => mock.restoreAll());

    test("check() sets status to UP when all active folders are synced", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        await monitorType.check(makeMonitor(), heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("Docs: ok") && heartbeat.msg.includes("Photos: ok"));
    });

    test("check() throws when a system error is active", async () => {
        mock.method(axios, "get", makeAxiosMock({ systemError: { errors: [{ message: "database is locked" }] } }));
        await assert.rejects(
            () => monitorType.check(makeMonitor(), makeHeartbeat(), {}),
            /System:.*database is locked/
        );
    });

    test("check() throws when a folder has failed items", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 5, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        await assert.rejects(() => monitorType.check(makeMonitor(), makeHeartbeat(), {}), /Photos: 5 items failed/);
    });

    test("check() throws when a folder is out of sync", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 24 * 1024 * 1024 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        await assert.rejects(() => monitorType.check(makeMonitor(), makeHeartbeat(), {}), /Photos: out of sync/);
    });

    test("check() throws when a folder is in error state", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "error", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        await assert.rejects(() => monitorType.check(makeMonitor(), makeHeartbeat(), {}), /Photos: error/);
    });

    test("check() sets status to UP when folder is syncing and no threshold is set", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "syncing", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        const heartbeat = makeHeartbeat();
        await monitorType.check(makeMonitor({ syncthingFolderSyncThreshold: 0 }), heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() sets status to UP when folder is syncing within threshold", async () => {
        const thirtyMinAgo = new Date(Date.now() - 1_800_000).toISOString();
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "syncing", stateChanged: thirtyMinAgo, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        const heartbeat = makeHeartbeat();
        await monitorType.check(makeMonitor({ syncthingFolderSyncThreshold: 3600 }), heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() throws when a folder is stuck syncing beyond threshold", async () => {
        const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "syncing", stateChanged: twoHoursAgo, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        await assert.rejects(
            () => monitorType.check(makeMonitor({ syncthingFolderSyncThreshold: 3600 }), makeHeartbeat(), {}),
            /Photos: stuck/
        );
    });

    test("check() combines multiple folder issues in one message", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 3, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 1024 * 1024 },
                },
            })
        );
        await assert.rejects(
            () => monitorType.check(makeMonitor(), makeHeartbeat(), {}),
            (err) => {
                assert.ok(err.message.includes("Photos"));
                assert.ok(err.message.includes("Docs"));
                assert.ok(err.message.includes(" | "));
                return true;
            }
        );
    });

    test("check() throws with clear message when API key is invalid", async () => {
        mock.method(axios, "get", async () => {
            const err = new Error("Forbidden");
            err.response = { status: 403 };
            throw err;
        });
        await assert.rejects(() => monitorType.check(makeMonitor(), makeHeartbeat(), {}), /Invalid Syncthing API key/);
    });

    test("check() sets status to UP when include filter matches a folder", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        await monitorType.check(
            makeMonitor({ syncthingFilter: "Photos", syncthingFilterMode: "include" }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("Photos: ok"));
    });

    test("check() sets status to UP when exclude filter skips a failing folder", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 5, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        const heartbeat = makeHeartbeat();
        await monitorType.check(
            makeMonitor({ syncthingFilter: "Photos", syncthingFilterMode: "exclude" }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() supports wildcard patterns in filter", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 5, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        const heartbeat = makeHeartbeat();
        // exclude all folders starting with "P" — Photos is skipped, Docs is OK
        await monitorType.check(makeMonitor({ syncthingFilter: "P*", syncthingFilterMode: "exclude" }), heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
    });
});

describe("SyncthingMonitorType - peers", () => {
    afterEach(() => mock.restoreAll());

    test("check() sets status to UP when filtered peer is connected", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        await monitorType.check(
            makeMonitor({ syncthingCheckType: "peers", syncthingFilter: "ServerB", syncthingFilterMode: "include" }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("ServerB: up"));
    });

    test("check() sets status to UP when peer is disconnected but within timeout", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        // Laptop lastSeen 1h ago, timeout 24h → OK
        await monitorType.check(
            makeMonitor({
                syncthingCheckType: "peers",
                syncthingFilter: "Laptop",
                syncthingFilterMode: "include",
                syncthingPeerTimeout: 86400,
            }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("Laptop: up"));
    });

    test("check() throws when peer is disconnected beyond timeout", async () => {
        mock.method(axios, "get", makeAxiosMock());
        // Laptop lastSeen 1h ago, timeout 30m → FAIL
        await assert.rejects(
            () =>
                monitorType.check(
                    makeMonitor({
                        syncthingCheckType: "peers",
                        syncthingFilter: "Laptop",
                        syncthingFilterMode: "include",
                        syncthingPeerTimeout: 1800,
                    }),
                    makeHeartbeat(),
                    {}
                ),
            /Laptop: down/
        );
    });

    test("check() ignores paused devices", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        // NAS is paused — should not cause failure even with 1s timeout
        await monitorType.check(
            makeMonitor({
                syncthingCheckType: "peers",
                syncthingFilter: "NAS",
                syncthingFilterMode: "include",
                syncthingPeerTimeout: 1,
            }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() matches device by name case-insensitively", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        await monitorType.check(
            makeMonitor({ syncthingCheckType: "peers", syncthingFilter: "serverb", syncthingFilterMode: "include" }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("ServerB: up"));
    });

    test("check() matches device by device ID prefix via wildcard", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        await monitorType.check(
            makeMonitor({ syncthingCheckType: "peers", syncthingFilter: "BBBBBBB*", syncthingFilterMode: "include" }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
        assert.ok(heartbeat.msg.includes("ServerB: up"));
    });

    test("check() throws when a peer has never connected", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                systemConnections: {
                    connections: {
                        [DEVICE_B]: { connected: false, paused: false },
                        [DEVICE_C]: { connected: false, paused: false },
                        [DEVICE_D]: { connected: false, paused: true },
                    },
                },
                statsDevice: {
                    [DEVICE_B]: { lastSeen: "0001-01-01T00:00:00Z" },
                    [DEVICE_C]: { lastSeen: ONE_HOUR_AGO },
                    [DEVICE_D]: { lastSeen: TWO_DAYS_AGO },
                },
            })
        );
        await assert.rejects(
            () =>
                monitorType.check(
                    makeMonitor({
                        syncthingCheckType: "peers",
                        syncthingFilter: "ServerB",
                        syncthingFilterMode: "include",
                    }),
                    makeHeartbeat(),
                    {}
                ),
            /ServerB: down/
        );
    });

    test("check() with exclude filter skips matching device", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        // Exclude Laptop (which is disconnected) → only ServerB is checked → UP
        await monitorType.check(
            makeMonitor({
                syncthingCheckType: "peers",
                syncthingFilterMode: "exclude",
                syncthingFilter: "Laptop, NAS",
                syncthingPeerTimeout: 1,
            }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() with no filter checks all non-paused devices", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        // Laptop is 1h ago, timeout=24h → still OK; NAS is paused → ignored
        await monitorType.check(
            makeMonitor({ syncthingCheckType: "peers", syncthingFilter: "", syncthingPeerTimeout: 86400 }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
    });
});

describe("SyncthingMonitorType - duration fields", () => {
    afterEach(() => mock.restoreAll());

    test("check() uses peer timeout in seconds — within timeout is OK", async () => {
        mock.method(axios, "get", makeAxiosMock());
        const heartbeat = makeHeartbeat();
        // Laptop lastSeen 1h ago, timeout=7200 (2h) → OK
        await monitorType.check(
            makeMonitor({
                syncthingCheckType: "peers",
                syncthingFilter: "Laptop",
                syncthingFilterMode: "include",
                syncthingPeerTimeout: 7200,
            }),
            heartbeat,
            {}
        );
        assert.strictEqual(heartbeat.status, UP);
    });

    test("check() uses peer timeout in seconds — exceeded timeout fails", async () => {
        mock.method(axios, "get", makeAxiosMock());
        // Laptop lastSeen 1h ago, timeout=1800 (30m) → FAIL
        await assert.rejects(
            () =>
                monitorType.check(
                    makeMonitor({
                        syncthingCheckType: "peers",
                        syncthingFilter: "Laptop",
                        syncthingFilterMode: "include",
                        syncthingPeerTimeout: 1800,
                    }),
                    makeHeartbeat(),
                    {}
                ),
            /Laptop: down/
        );
    });

    test("check() uses folder sync threshold in seconds — exceeded threshold fails", async () => {
        const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "syncing", stateChanged: twoHoursAgo, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        // threshold=3600 (1h), folder stuck 2h → FAIL
        await assert.rejects(
            () => monitorType.check(makeMonitor({ syncthingFolderSyncThreshold: 3600 }), makeHeartbeat(), {}),
            /Photos: stuck/
        );
    });

    test("check() treats folder sync threshold of 0 as disabled", async () => {
        mock.method(
            axios,
            "get",
            makeAxiosMock({
                dbStatus: {
                    photos: { state: "syncing", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                    docs: { state: "idle", stateChanged: ONE_HOUR_AGO, errors: 0, needBytes: 0 },
                },
            })
        );
        const heartbeat = makeHeartbeat();
        await monitorType.check(makeMonitor({ syncthingFolderSyncThreshold: 0 }), heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
    });
});

describe("SyncthingMonitorType - TLS", () => {
    afterEach(() => mock.restoreAll());

    test("check() passes no httpsAgent for http URLs", async () => {
        let capturedOptions;
        mock.method(axios, "get", async (url, options) => {
            capturedOptions = capturedOptions ?? options;
            return makeAxiosMock()(url);
        });
        await monitorType.check(makeMonitor(), makeHeartbeat(), {});
        assert.strictEqual(capturedOptions.httpsAgent, undefined);
    });

    test("check() passes httpsAgent with rejectUnauthorized=true for https URL when ignoreTls is false", async () => {
        let capturedAgent;
        mock.method(axios, "get", async (url, options) => {
            capturedAgent = capturedAgent ?? options?.httpsAgent;
            return makeAxiosMock()(url);
        });
        await monitorType.check(
            makeMonitor({ syncthingUrl: "https://localhost:8384", ignoreTls: false }),
            makeHeartbeat(),
            {}
        );
        assert.ok(capturedAgent, "httpsAgent should be set for https URLs");
        assert.strictEqual(capturedAgent.options.rejectUnauthorized, true);
    });

    test("check() passes httpsAgent with rejectUnauthorized=false for https URL when ignoreTls is true", async () => {
        let capturedAgent;
        mock.method(axios, "get", async (url, options) => {
            capturedAgent = capturedAgent ?? options?.httpsAgent;
            return makeAxiosMock()(url);
        });
        await monitorType.check(
            makeMonitor({ syncthingUrl: "https://localhost:8384", ignoreTls: true }),
            makeHeartbeat(),
            {}
        );
        assert.ok(capturedAgent, "httpsAgent should be set for https URLs");
        assert.strictEqual(capturedAgent.options.rejectUnauthorized, false);
    });
});

describe("SyncthingMonitorType - misc", () => {
    afterEach(() => mock.restoreAll());

    test("check() throws for unknown check type", async () => {
        mock.method(axios, "get", makeAxiosMock());
        await assert.rejects(
            () => monitorType.check(makeMonitor({ syncthingCheckType: "unknown" }), makeHeartbeat(), {}),
            /Unknown check type/
        );
    });

    test("check() throws with descriptive message on connection refused", async () => {
        mock.method(axios, "get", async () => {
            const err = new Error("connect ECONNREFUSED");
            err.code = "ECONNREFUSED";
            throw err;
        });
        await assert.rejects(
            () => monitorType.check(makeMonitor(), makeHeartbeat(), {}),
            /Cannot connect to Syncthing/
        );
    });
});
