import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { R } from "redbean-node";
import { auth } from "../../server/better-auth";
import { Settings } from "../../server/settings";
import * as checkVersion from "../../server/check-version";

// @ts-ignore
import TestDB from "../mock-testdb";

test("MCP", async (t) => {
    const testDb = new TestDB("./data/test-mcp");
    const userID = "mcp-test-user";
    let apiKey = "";
    let baseUrl = "";
    let httpServer: Server;

    /**
     * Send one JSON-RPC message to the MCP endpoint and parse the answer
     * @param {object} body JSON-RPC message
     * @param {object} headers Extra headers
     * @returns {Promise<object>} Status code and parsed JSON-RPC response
     */
    async function mcpRequest(body: object, headers: object = {}) {
        const response = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json, text/event-stream",
                ...headers,
            },
            body: JSON.stringify(body),
        });
        const text = await response.text();
        const data = text
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .pop();

        return {
            status: response.status,
            body: data ? JSON.parse(data) : null,
            text,
        };
    }

    t.before(async () => {
        try {
            fs.rmSync("./data/test-mcp", { recursive: true, force: true });
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

        const created = await auth().api.createApiKey({
            body: {
                name: "test key",
                userId: userID,
            },
        });

        apiKey = created.key;

        const { default: mcpRouter } = await import("../../server/routers/mcp-router");
        const app = express();
        app.use(express.json());
        app.use(mcpRouter);

        httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    });

    t.after(async () => {
        await new Promise((resolve) => {
            httpServer.close(() => resolve(null));
            httpServer.closeAllConnections();
        });
        await testDb.destroy();
    });

    await t.test("POST /mcp rejects a request without an API key", async () => {
        await Settings.set("apiEnabled", true);

        const result = await mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });

        assert.strictEqual(result.status, 401);
    });

    await t.test("POST /mcp rejects a request when the API is disabled", async () => {
        await Settings.set("apiEnabled", false);

        const result = await mcpRequest(
            { jsonrpc: "2.0", id: 1, method: "tools/list" },
            { authorization: `Bearer ${apiKey}` }
        );

        assert.strictEqual(result.status, 403);

        await Settings.set("apiEnabled", true);
    });

    await t.test("tools/list exposes every documented API reading", async () => {
        const result = await mcpRequest(
            { jsonrpc: "2.0", id: 1, method: "tools/list" },
            { authorization: `Bearer ${apiKey}` }
        );

        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(result.body.result.tools.map((tool: { name: string }) => tool.name).sort(), [
            "get_info",
            "get_monitors",
        ]);
    });

    await t.test("tools/call get_info returns the server information", async () => {
        const result = await mcpRequest(
            {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: { name: "get_info", arguments: {} },
            },
            { authorization: `Bearer ${apiKey}` }
        );

        assert.strictEqual(result.status, 200);
        const info = JSON.parse(result.body.result.content[0].text).info;
        assert.strictEqual(info.version, checkVersion.version);
        assert.ok(info.serverTimezone);
    });

    await t.test("tools/call get_monitors returns the compact monitor list", async () => {
        const monitor = R.dispense("monitor");
        monitor.name = "mcp-monitor";
        monitor.type = "http";
        monitor.url = "https://example.com";
        monitor.interval = 60;
        monitor.active = 1;
        await R.store(monitor);

        try {
            const result = await mcpRequest(
                {
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: { name: "get_monitors", arguments: {} },
                },
                { authorization: `Bearer ${apiKey}` }
            );

            assert.strictEqual(result.status, 200);
            const monitors = JSON.parse(result.body.result.content[0].text).monitors;
            const entry = monitors.find((item: { id: number }) => item.id === monitor.id);

            assert.strictEqual(entry.name, "mcp-monitor");
            assert.strictEqual(entry.active, true);
            assert.deepStrictEqual(entry.tags, []);
            assert.strictEqual("url" in entry, false);
        } finally {
            await R.trash(monitor);
        }
    });
});
