import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { createRequire } from "node:module";
import dayjs from "dayjs";

// @ts-ignore
import TestDB from "../mock-testdb";
import { UptimeKumaServer } from "../../server/uptime-kuma-server";

const require = createRequire(import.meta.url);
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");
const { DOWN, UP } = require("../../src/util");

test("Push API", async (t) => {
    const testDb = new TestDB("./data/test-push-api");
    const notificationHits: string[] = [];
    let notificationServer: http.Server;
    let apiServer: http.Server;
    let baseUrl = "";
    let pushToken = "";
    let monitorID = 0;

    t.before(async () => {
        try {
            fs.rmSync("./data/test-push-api", { recursive: true, force: true });
        } catch {
            console.warn("Unable to remove the old test database, reusing it.");
        }

        await testDb.create();
        Notification.init();

        notificationServer = http.createServer((request, response) => {
            notificationHits.push(request.url ?? "");
            response.end("ok");
        });
        notificationServer.listen(0, "127.0.0.1");
        await new Promise((resolve) => notificationServer.once("listening", resolve));

        const notificationPort = (notificationServer.address() as AddressInfo).port;

        const monitor = R.dispense("monitor");
        monitor.name = "push-test";
        monitor.type = "push";
        monitor.push_token = `push-test-${Date.now()}`;
        monitor.interval = 60;
        monitor.active = 1;
        monitor.maxretries = 0;
        monitor.resendInterval = 0;
        monitor.upsideDown = false;
        await R.store(monitor);
        pushToken = monitor.push_token;
        monitorID = monitor.id;

        const notification = R.dispense("notification");
        notification.name = "push-test-webhook";
        notification.active = 1;
        notification.config = JSON.stringify({
            type: "webhook",
            webhookURL: `http://127.0.0.1:${notificationPort}/notify`,
            webhookContentType: "json",
        });
        await R.store(notification);

        const link = R.dispense("monitor_notification");
        link.monitor_id = monitor.id;
        link.notification_id = notification.id;
        await R.store(link);

        const downBeat = R.dispense("heartbeat");
        downBeat.monitor_id = monitor.id;
        downBeat.status = DOWN;
        downBeat.time = R.isoDateTimeMillis(dayjs.utc().subtract(1, "minute"));
        downBeat.msg = "down";
        downBeat.ping = 1;
        downBeat.duration = 0;
        downBeat.retries = 0;
        downBeat.downCount = 0;
        downBeat.important = 1;
        await R.store(downBeat);

        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.set("query parser", UptimeKumaServer.getInstance().app.get("query parser"));
        app.use(apiRouter);
        apiServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => apiServer.once("listening", resolve));
        baseUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
    });

    t.after(async () => {
        if (apiServer) {
            await new Promise((resolve) => apiServer.close(resolve));
        }
        if (notificationServer) {
            await new Promise((resolve) => notificationServer.close(resolve));
        }
        await testDb.destroy();
    });

    await t.test("a repeated msg keeps the first value, stores it and notifies once", async () => {
        const response = await fetch(`${baseUrl}/api/push/${pushToken}?status=up&msg=FIRST&msg=SECOND&ping=1.8`);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.ok, true);

        const latest = await R.findOne("heartbeat", " id = (select MAX(id) from heartbeat where monitor_id = ?)", [
            monitorID,
        ]);
        assert.strictEqual(latest.status, UP);
        assert.strictEqual(latest.msg, "FIRST");
        assert.strictEqual(notificationHits.length, 1, "the stored heartbeat must notify once");
    });
});
