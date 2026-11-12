import { after, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { R } from "redbean-node";
import { UP } from "../../../src/util";
import Monitor from "../../../server/model/monitor";
import { UptimeKumaServer } from "../../../server/uptime-kuma-server";

dayjs.extend(utc);

const originals = {
    findOne: R.findOne,
    dispense: R.dispense,
    getPreviousHeartbeat: Monitor.getPreviousHeartbeat,
    isUnderMaintenance: Monitor.isUnderMaintenance,
};

after(() => {
    Object.assign(R, { findOne: originals.findOne, dispense: originals.dispense });
    Object.assign(Monitor, {
        getPreviousHeartbeat: originals.getPreviousHeartbeat,
        isUnderMaintenance: originals.isUnderMaintenance,
    });
});

test("Push monitor uptime", async (t) => {
    await t.test("ignores repeated same-status pushes within one heartbeat interval", async () => {
        const monitorId = 9001;
        const intervalMs = 60_000;
        const now = Date.now();
        const monitor = {
            id: monitorId,
            interval: intervalMs / 1000,
            maxretries: 0,
            isUpsideDown: () => false,
        };
        const previousHeartbeat = {
            time: new Date(now - 20_000).toISOString(),
            status: UP,
            downCount: 0,
        };
        const server = UptimeKumaServer.getInstance();
        const previousMonitorList = server.monitorList;
        let storeCalls = 0;
        R.findOne = async () => monitor;
        R.dispense = () => ({});
        Monitor.getPreviousHeartbeat = async () => previousHeartbeat;
        Monitor.isUnderMaintenance = async () => false;
        server.monitorList = {
            ...previousMonitorList,
            [monitorId]: { nextHeartbeatTime: new Date(now + 30_000).toISOString() },
        };

        const { default: apiRouter } = await import("../../../server/routers/api-router");
        const app = express();
        app.use(apiRouter);
        const httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        const originalStore = R.store;
        R.store = async () => {
            storeCalls++;
        };

        try {
            const response = await fetch(
                `http://127.0.0.1:${(httpServer.address()).port}/api/push/test-token`
            );
            const body = await response.json();

            assert.deepStrictEqual(body, { ok: true, msg: "ping was not saved" });
            assert.strictEqual(storeCalls, 0);
        } finally {
            R.store = originalStore;
            server.monitorList = previousMonitorList;
            await new Promise((resolve) => httpServer.close(resolve));
        }
    });
});
