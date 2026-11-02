import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import express from "express";
import { R } from "redbean-node";
import { auth } from "../../server/better-auth";
import { Settings } from "../../server/settings";
import { UptimeKumaServer } from "../../server/uptime-kuma-server";
import { initDayjs } from "../../server/util";

// @ts-ignore
import TestDB from "../mock-testdb";

const require = createRequire(import.meta.url);
const Maintenance = require("../../server/model/maintenance");
const Monitor = require("../../server/model/monitor");

test("Maintenance API", async (t) => {
    const testDb = new TestDB("./data/test-maintenance-api");
    const userID = "maintenance-api-test-user";
    const server = UptimeKumaServer.getInstance();
    let apiKey = "";
    let baseUrl = "";
    let httpServer: ReturnType<typeof express.application.listen>;
    let monitorID = 0;
    let statusPageID = 0;

    /**
     * Call the maintenance API with the test API key
     * @param {string} method HTTP method
     * @param {string} path Path below the server root
     * @param {object} body JSON body, undefined for none
     * @param {boolean} withKey Send the API key?
     * @returns {Promise<{status: number, body: any}>} Response
     */
    async function call(method: string, path: string, body?: object, withKey = true) {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (withKey) {
            headers.authorization = `Bearer ${apiKey}`;
        }
        const response = await fetch(baseUrl + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
    }

    t.before(async () => {
        // The server does this at startup, the timezone conversion of single windows needs it
        initDayjs();

        // A previous failed run may have left the database behind
        try {
            fs.rmSync("./data/test-maintenance-api", { recursive: true, force: true });
        } catch {
            console.warn("Unable to remove the old test database, reusing it.");
        }

        await testDb.create();
        await auth(true);
        await R.knex("better_auth_apikey").del();
        await R.knex("better_auth_user").del();
        await R.knex("better_auth_user").insert({
            id: userID,
            name: "admin",
            email: "admin@noreply.uptime-kuma.internal",
            emailVerified: 1,
            username: "admin",
            displayUsername: "admin",
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        const created = await auth().api.createApiKey({ body: { name: "test key", userId: userID } });
        apiKey = created.key;
        await Settings.set("apiEnabled", true);

        const monitor = R.dispense("monitor");
        monitor.name = "maintenance-monitor";
        monitor.type = "http";
        monitor.url = "https://example.com";
        monitor.interval = 60;
        monitor.active = 1;
        monitorID = await R.store(monitor);

        const statusPage = R.dispense("status_page");
        statusPage.slug = "maintenance-test";
        statusPage.title = "Maintenance test";
        statusPage.icon = "/icon.svg";
        statusPage.theme = "auto";
        statusPageID = await R.store(statusPage);

        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.use(express.json());
        app.use(apiRouter);
        httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    });

    t.after(async () => {
        await new Promise((resolve) => httpServer.close(resolve));
        for (const maintenance of Object.values(server.maintenanceList)) {
            (maintenance as any).stop();
        }
        await testDb.destroy();
    });

    await t.test("rejects a request without a valid API key", async () => {
        const missing = await call("GET", "/api/maintenance", undefined, false);
        assert.strictEqual(missing.status, 401);

        await Settings.set("apiEnabled", false);
        const disabled = await call("GET", "/api/maintenance");
        await Settings.set("apiEnabled", true);
        assert.strictEqual(disabled.status, 403);
    });

    await t.test(
        "creates a manual window, links monitor and status page once and owns it by the key user",
        async () => {
            const created = await call("POST", "/api/maintenance", {
                title: "  Manual window  ",
                monitorIds: [monitorID, monitorID],
                statusPageIds: [statusPageID],
                active: true,
            });
            assert.strictEqual(created.status, 201);
            assert.strictEqual(created.body.ok, true);

            const id = created.body.maintenanceID;
            const row = await R.getRow("SELECT title, strategy, active, user_id FROM maintenance WHERE id = ?", [id]);
            assert.strictEqual(row.title, "Manual window");
            assert.strictEqual(row.strategy, "manual");
            assert.strictEqual(Boolean(row.active), true);
            assert.strictEqual(row.user_id, userID);

            const monitorLinks = await R.getAll("SELECT monitor_id FROM monitor_maintenance WHERE maintenance_id = ?", [
                id,
            ]);
            assert.deepStrictEqual(
                monitorLinks.map((link: { monitor_id: number }) => link.monitor_id),
                [monitorID]
            );
            const statusPageLinks = await R.getAll(
                "SELECT status_page_id FROM maintenance_status_page WHERE maintenance_id = ?",
                [id]
            );
            assert.strictEqual(statusPageLinks.length, 1);
        }
    );

    await t.test("rejects invalid input with 400 and stores nothing", async () => {
        const before = await R.getCell("SELECT COUNT(*) FROM maintenance");
        const cases: [object, RegExp][] = [
            [{ title: "" }, /title/],
            [{ title: "x".repeat(151) }, /title/],
            [{ title: "x", strategy: "cron" }, /strategy/],
            [{ title: "x", monitorIds: ["1"] }, /monitorIds/],
            [{ title: "x", monitorIds: [999999] }, /unknown monitor/],
            [{ title: "x", statusPageIds: [999999] }, /unknown status page/],
            [{ title: "x", timezone: "Mars/Olympus" }, /timezone/],
            [{ title: "x", active: "yes" }, /active/],
            [{ title: "x", strategy: "single" }, /start and end/],
            [{ title: "x", strategy: "single", start: "soon", end: "later" }, /ISO 8601/],
            [
                { title: "x", strategy: "single", start: "2030-01-02T00:00:00Z", end: "2030-01-01T00:00:00Z" },
                /after start/,
            ],
        ];

        for (const [body, message] of cases) {
            const response = await call("POST", "/api/maintenance", body);
            assert.strictEqual(response.status, 400, JSON.stringify(body));
            assert.match(response.body.msg, message);
        }

        assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM maintenance"), before);
    });

    await t.test("stores a single window as wall-clock time in its own timezone", async () => {
        const created = await call("POST", "/api/maintenance", {
            title: "Single window",
            strategy: "single",
            timezone: "Europe/Copenhagen",
            start: "2030-01-02T00:00:00Z",
            end: "2030-01-02T01:00:00Z",
        });
        assert.strictEqual(created.status, 201);

        const row = await R.getRow("SELECT start_date, end_date FROM maintenance WHERE id = ?", [
            created.body.maintenanceID,
        ]);
        // January in Copenhagen is UTC+1
        assert.match(String(row.start_date), /2030-01-02[ T]01:00:00/);
        assert.match(String(row.end_date), /2030-01-02[ T]02:00:00/);
    });

    await t.test("a create that fails while starting the window leaves nothing behind", async () => {
        const before = await R.getCell("SELECT COUNT(*) FROM maintenance");
        const listBefore = Object.keys(server.maintenanceList).length;
        const originalRun = Maintenance.prototype.run;
        Maintenance.prototype.run = async () => {
            throw new Error("boom");
        };

        try {
            const response = await call("POST", "/api/maintenance", {
                title: "Will fail",
                monitorIds: [monitorID],
                statusPageIds: [statusPageID],
            });
            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.msg, "Internal server error");
        } finally {
            Maintenance.prototype.run = originalRun;
        }

        assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM maintenance"), before);
        assert.strictEqual(Object.keys(server.maintenanceList).length, listBefore);
        assert.strictEqual(
            await R.getCell(
                "SELECT COUNT(*) FROM monitor_maintenance WHERE maintenance_id NOT IN (SELECT id FROM maintenance)"
            ),
            0
        );
    });

    await t.test("a failing dashboard push does not fail a change that is already stored", async () => {
        const original = server.sendMaintenanceListToDashboard;
        server.sendMaintenanceListToDashboard = async () => {
            throw new Error("boom");
        };

        try {
            const created = await call("POST", "/api/maintenance", { title: "Pushed badly", active: true });
            assert.strictEqual(created.status, 201);
            const id = created.body.maintenanceID;
            assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM maintenance WHERE id = ?", [id]), 1);

            assert.strictEqual((await call("POST", `/api/maintenance/${id}/pause`)).status, 200);
            assert.strictEqual((await call("DELETE", `/api/maintenance/${id}`)).status, 200);
        } finally {
            server.sendMaintenanceListToDashboard = original;
        }
    });

    await t.test("a linked monitor is under maintenance exactly while its window is", async () => {
        const monitor = R.dispense("monitor");
        monitor.name = "maintenance-state-monitor";
        monitor.type = "http";
        monitor.url = "https://example.com";
        monitor.interval = 60;
        monitor.active = 1;
        const stateMonitorID = await R.store(monitor);
        const underMaintenance = () => Monitor.isUnderMaintenance(stateMonitorID);

        assert.strictEqual(await underMaintenance(), false);

        const manual = await call("POST", "/api/maintenance", {
            title: "State manual",
            monitorIds: [stateMonitorID],
            active: true,
        });
        const manualID = manual.body.maintenanceID;
        assert.strictEqual(await underMaintenance(), true);

        await call("POST", `/api/maintenance/${manualID}/pause`);
        assert.strictEqual(await underMaintenance(), false);
        await call("POST", `/api/maintenance/${manualID}/resume`);
        assert.strictEqual(await underMaintenance(), true);
        await call("DELETE", `/api/maintenance/${manualID}`);
        assert.strictEqual(await underMaintenance(), false);

        // Single windows are stored as wall-clock time in their own timezone, a wrong conversion would
        // shift the window by an hour or more and miss "now"
        const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
        const single = (title: string, start: number, end: number) =>
            call("POST", "/api/maintenance", {
                title,
                strategy: "single",
                timezone: "Europe/Copenhagen",
                monitorIds: [stateMonitorID],
                active: true,
                start: iso(start),
                end: iso(end),
            });

        const later = await single("State later", 180, 240);
        assert.strictEqual(later.status, 201);
        assert.strictEqual(await underMaintenance(), false);

        const around = await single("State around now", -30, 30);
        assert.strictEqual(around.status, 201);
        assert.strictEqual(await underMaintenance(), true);

        await call("DELETE", `/api/maintenance/${around.body.maintenanceID}`);
        await call("DELETE", `/api/maintenance/${later.body.maintenanceID}`);
        assert.strictEqual(await underMaintenance(), false);
    });

    await t.test("lists and reads windows, and answers 404 for an unknown id", async () => {
        const created = await call("POST", "/api/maintenance", { title: "Readable" });
        const id = created.body.maintenanceID;

        const list = await call("GET", "/api/maintenance");
        assert.strictEqual(list.status, 200);
        assert.ok(list.body.maintenance.some((item: { id: number }) => item.id === id));

        const one = await call("GET", `/api/maintenance/${id}`);
        assert.strictEqual(one.status, 200);
        assert.strictEqual(one.body.maintenance.title, "Readable");
        assert.strictEqual(one.body.maintenance.status, "inactive");

        assert.strictEqual((await call("GET", "/api/maintenance/999999")).status, 404);
        assert.strictEqual((await call("GET", "/api/maintenance/abc")).status, 404);
    });

    await t.test("pauses and resumes a window, and both are repeatable", async () => {
        const created = await call("POST", "/api/maintenance", { title: "Toggle", active: true });
        const id = created.body.maintenanceID;

        for (const [action, active] of [
            ["pause", false],
            ["pause", false],
            ["resume", true],
            ["resume", true],
        ] as const) {
            const response = await call("POST", `/api/maintenance/${id}/${action}`);
            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.active, active);
            const stored = await R.getCell("SELECT active FROM maintenance WHERE id = ?", [id]);
            assert.strictEqual(Boolean(stored), active);
        }

        assert.strictEqual((await call("POST", "/api/maintenance/999999/pause")).status, 404);
        assert.strictEqual((await call("POST", "/api/maintenance/999999/resume")).status, 404);
    });

    await t.test("deletes a window and its links", async () => {
        const created = await call("POST", "/api/maintenance", { title: "Delete me", monitorIds: [monitorID] });
        const id = created.body.maintenanceID;

        const deleted = await call("DELETE", `/api/maintenance/${id}`);
        assert.strictEqual(deleted.status, 200);
        assert.strictEqual(await R.getCell("SELECT COUNT(*) FROM maintenance WHERE id = ?", [id]), 0);
        assert.strictEqual(
            await R.getCell("SELECT COUNT(*) FROM monitor_maintenance WHERE maintenance_id = ?", [id]),
            0
        );
        assert.strictEqual((await call("DELETE", `/api/maintenance/${id}`)).status, 404);
    });

    await t.test("documents the routes in the OpenAPI document with {id} path parameters", async () => {
        const response = await call("GET", "/api/openapi.json");
        assert.strictEqual(response.status, 200);

        const paths = response.body.paths;
        assert.strictEqual(paths["/api/maintenance"].get.operationId, "get_maintenance_list");
        assert.strictEqual(paths["/api/maintenance"].post.operationId, "create_maintenance");
        assert.strictEqual(paths["/api/maintenance/{id}"].get.operationId, "get_maintenance");
        assert.strictEqual(paths["/api/maintenance/{id}"].delete.operationId, "delete_maintenance");
        assert.strictEqual(paths["/api/maintenance/{id}/pause"].post.operationId, "pause_maintenance");
        assert.strictEqual(paths["/api/maintenance/{id}/resume"].post.operationId, "resume_maintenance");
        assert.strictEqual(paths["/api/maintenance/:id"], undefined);
    });
});
