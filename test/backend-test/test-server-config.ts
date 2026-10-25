import { describe, test } from "node:test";
import assert from "node:assert";
import { afterEach } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
const { R } = require("redbean-node");
const Monitor = require("../../server/model/monitor");

const originals = {
    findAll: R.findAll,
    preparePreloadData: Monitor.preparePreloadData,
};

afterEach(() => {
    R.findAll = originals.findAll;
    Monitor.preparePreloadData = originals.preparePreloadData;
});

/**
 * Stub the database rows and the preload data
 * @returns {object} One monitor row
 */
function stubMonitorList() {
    const monitor = {
        id: 1,
        name: "API",
        type: "http",
        parent: null,
        interval: 60,
        weight: 2000,
        active: 1,
        toJSON: () => ({ id: 1, full: true }),
    };
    R.findAll = async () => [monitor];
    Monitor.preparePreloadData = async () => ({
        paths: new Map([[1, ["Group"]]]),
        activeStatus: new Map([[1, true]]),
        childrenIDs: new Map([[1, []]]),
        tags: new Map([[1, []]]),
    });
    return monitor;
}

describe("socket.io payload compression", () => {
    test("compresses websocket and polling payloads above 1 KB", () => {
        const server = UptimeKumaServer.getInstance();
        const opts = server.io.engine.opts;

        assert.strictEqual(opts.perMessageDeflate.threshold, 1024);
        assert.strictEqual(opts.httpCompression.threshold, 1024);
    });
});

describe("getMonitorJSONList()", () => {
    test("returns the compact payload for the dashboard", async () => {
        stubMonitorList();
        const server = Object.create(UptimeKumaServer.prototype);

        const list = await server.getMonitorJSONList(null, true);

        assert.deepStrictEqual(list[1], {
            id: 1,
            name: "API",
            type: "http",
            active: true,
            parent: null,
            childrenIDs: [],
            tags: [],
            path: ["Group"],
            pathName: "Group",
            interval: 60,
            weight: 2000,
        });
    });

    test("returns the full payload when compact is not requested", async () => {
        stubMonitorList();
        const server = Object.create(UptimeKumaServer.prototype);

        const list = await server.getMonitorJSONList(null, false);

        assert.deepStrictEqual(list[1], { id: 1, full: true });
    });
});
