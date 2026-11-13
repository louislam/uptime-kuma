import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import express from "express";
import { R } from "redbean-node";
import { auth } from "../../server/better-auth";
import { readApiKey, requireApiKey } from "../../server/auth";
import { Settings } from "../../server/settings";
import * as checkVersion from "../../server/check-version";

// @ts-ignore
import TestDB from "../mock-testdb";

/**
 * Minimal Express request for middleware tests
 * @param {object} headers Request headers
 * @returns {object} Fake request
 */
function fakeRequest(headers: object) {
    return { headers };
}

/**
 * Minimal Express response for middleware tests
 * @returns {object} Fake response
 */
function fakeResponse() {
    const response = {
        statusCode: 200,
        body: null,
        locals: {},
        /**
         * Record the status code
         * @param {number} code Status code
         * @returns {object} This response
         */
        status(code: number) {
            response.statusCode = code;
            return response;
        },
        /**
         * Record the JSON body
         * @param {object} body JSON body
         * @returns {object} This response
         */
        json(body: object) {
            response.body = body;
            return response;
        },
    };
    return response;
}

test("API", async (t) => {
    const testDb = new TestDB("./data/test-api");
    const userID = "api-test-user";
    let apiKey = "";

    t.before(async () => {
        // A previous failed run may have left the database behind
        try {
            fs.rmSync("./data/test-api", { recursive: true, force: true });
        } catch (e) {
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

        const created = await auth().api.createApiKey({
            body: {
                name: "test key",
                userId: userID,
            },
        });

        apiKey = created.key;
    });

    t.after(async () => {
        await testDb.destroy();
    });

    await t.test("readApiKey() returns the last word of the authorization header", () => {
        assert.strictEqual(readApiKey("Bearer uk1_abc"), "uk1_abc");
        assert.strictEqual(readApiKey("bearer   uk1_abc  "), "uk1_abc");
    });

    await t.test("readApiKey() returns null without an authorization header", () => {
        assert.strictEqual(readApiKey(), null);
        assert.strictEqual(readApiKey(""), null);
    });

    await t.test("requireApiKey rejects a request when the API is disabled", async () => {
        await Settings.set("apiEnabled", false);
        const res = fakeResponse();

        await requireApiKey(fakeRequest({ authorization: `Bearer ${apiKey}` }), res, () =>
            assert.fail("next() called")
        );

        assert.strictEqual(res.statusCode, 403);
    });

    await t.test("requireApiKey rejects a request without an API key", async () => {
        await Settings.set("apiEnabled", true);
        const res = fakeResponse();

        await requireApiKey(fakeRequest({}), res, () => assert.fail("next() called"));

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.msg, "Missing API key");
    });

    await t.test("requireApiKey rejects an invalid API key", async () => {
        const res = fakeResponse();

        await requireApiKey(fakeRequest({ authorization: "Bearer uk1_invalid" }), res, () =>
            assert.fail("next() called")
        );

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.msg, "Invalid API key");
    });

    await t.test("requireApiKey passes a valid API key to the route", async () => {
        const res = fakeResponse();
        let nextCalled = false;

        await requireApiKey(fakeRequest({ authorization: `Bearer ${apiKey}` }), res, () => {
            nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
        assert.strictEqual(res.locals.apiKey, apiKey);
        assert.strictEqual(res.locals.session.user.id, userID);
    });

    await t.test("GET /api/info returns the server information", async () => {
        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.use(apiRouter);

        const httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        const baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
        const url = `${baseUrl}/api/info`;
        const headers = { authorization: `Bearer ${apiKey}` };

        try {
            await Settings.set("apiEnabled", false);
            const disabled = await fetch(url, { headers });
            const disabledDocs = await fetch(`${baseUrl}/api/docs`);
            const disabledDocsBody = await disabledDocs.text();

            assert.strictEqual(disabled.status, 403);
            assert.strictEqual(disabledDocs.status, 403);
            assert.match(disabledDocsBody, /API is disabled/);

            await Settings.set("apiEnabled", true);
            const response = await fetch(url, { headers });
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.strictEqual(body.ok, true);
            assert.strictEqual(body.info.version, checkVersion.version);
            assert.ok(body.info.serverTimezone);
        } finally {
            await new Promise((resolve) => httpServer.close(resolve));
        }
    });

    await t.test("GET /api/monitors returns the compact monitor list", async () => {
        const monitor = R.dispense("monitor");
        monitor.name = "api-monitor";
        monitor.type = "http";
        monitor.url = "https://example.com";
        monitor.interval = 60;
        monitor.active = 1;
        monitor.weight = 3000;
        await R.store(monitor);

        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.use(apiRouter);

        const httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        const baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

        try {
            await Settings.set("apiEnabled", true);
            const response = await fetch(`${baseUrl}/api/monitors`, {
                headers: { authorization: `Bearer ${apiKey}` },
            });
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.strictEqual(body.ok, true);

            const entry = body.monitors.find((item: { id: number }) => item.id === monitor.id);

            assert.strictEqual(entry.name, "api-monitor");
            assert.strictEqual(entry.type, "http");
            assert.strictEqual(entry.active, true);
            assert.strictEqual(entry.interval, 60);
            assert.strictEqual(entry.weight, 3000);
            assert.strictEqual(entry.parent, null);
            assert.deepStrictEqual(entry.childrenIDs, []);
            assert.deepStrictEqual(entry.tags, []);
            assert.deepStrictEqual(entry.path, ["api-monitor"]);
            assert.strictEqual(entry.pathName, "api-monitor");
            // The compact payload must not leak the monitor URL or other settings
            assert.strictEqual("url" in entry, false);
        } finally {
            await new Promise((resolve) => httpServer.close(resolve));
            await R.trash(monitor);
        }
    });

    await t.test("GET /api/openapi.json documents /api/info and /api/docs serves the UI", async () => {
        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.use(apiRouter);

        const httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        const baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

        try {
            await Settings.set("apiEnabled", true);

            const anonymousSpec = await fetch(`${baseUrl}/api/openapi.json`);
            const anonymousDocs = await fetch(`${baseUrl}/api/docs`);
            const anonymousDocsBody = await anonymousDocs.text();

            assert.strictEqual(anonymousSpec.status, 401);
            assert.strictEqual(anonymousDocs.status, 401);
            assert.match(anonymousDocsBody, /Log in to Uptime Kuma/);

            const headers = { authorization: `Bearer ${apiKey}` };
            const specResponse = await fetch(`${baseUrl}/api/openapi.json`, { headers });
            const spec = await specResponse.json();

            assert.strictEqual(specResponse.status, 200);
            assert.strictEqual(spec.openapi, "3.1.0");
            assert.strictEqual(spec.paths["/api/info"].get.responses["200"].description, "Server information");
            assert.strictEqual(spec.paths["/api/info"].get.responses["401"].description, "Missing or invalid API key");
            assert.deepStrictEqual(spec.paths["/api/info"].get.security, [{ bearerAuth: [] }]);
            assert.deepStrictEqual(spec.paths["/api/monitors"].get.security, [{ bearerAuth: [] }]);
            assert.strictEqual(spec.paths["/api/monitors"].get.operationId, "get_monitors");
            assert.strictEqual(spec.paths["/api/info"].get.operationId, "get_info");
            assert.strictEqual(spec.paths["/api/monitors"].get.responses["200"].description, "Monitor list");

            const docsResponse = await fetch(`${baseUrl}/api/docs`, { headers });
            const docs = await docsResponse.text();

            assert.strictEqual(docsResponse.status, 200);
            assert.match(docs, /<html/i);
        } finally {
            await new Promise((resolve) => httpServer.close(resolve));
        }
    });

    await t.test("the API router keeps the existing badge and entry-page routes", async () => {
        const { default: apiRouter } = await import("../../server/routers/api-router");
        const paths: string[] = [];

        /**
         * Collect route paths, including the routes of nested routers
         * @param {object} router Express router
         * @returns {void}
         */
        function collect(router: any) {
            for (const layer of router.stack) {
                if (layer.route) {
                    paths.push(layer.route.path);
                } else if (layer.handle?.stack) {
                    collect(layer.handle);
                }
            }
        }

        collect(apiRouter);

        assert.ok(paths.includes("/api/entry-page"));
        assert.ok(paths.includes("/api/badge/:id/status"));
        assert.ok(paths.includes("/api/badge/:id/uptime/:duration?"));
        assert.ok(paths.includes("/api/info"));
        assert.ok(paths.includes("/api/monitors"));
    });

    await t.test("GET /api/info accepts more than 10 requests per key", async () => {
        const { default: apiRouter } = await import("../../server/routers/api-router");
        const app = express();
        app.use(apiRouter);

        const httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/api/info`;

        try {
            await Settings.set("apiEnabled", true);
            const headers = { authorization: `Bearer ${apiKey}` };
            let status = 0;

            // Better Auth defaults to 10 requests per key per 24h, which must not apply here
            for (let i = 0; i < 12; i++) {
                const response = await fetch(url, { headers });
                status = response.status;
            }

            assert.strictEqual(status, 200);
        } finally {
            await new Promise((resolve) => httpServer.close(resolve));
        }
    });
});
