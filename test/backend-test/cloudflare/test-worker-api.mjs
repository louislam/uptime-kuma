import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Cloudflare Worker API", () => {
    test("D1 migration creates network profiles and heartbeat-compatible tables", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0001_network_profiles.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS network_profiles/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitors/);
        assert.match(migrationSql, /network_profile_id TEXT/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS heartbeats/);
        assert.match(migrationSql, /INSERT OR IGNORE INTO network_profiles/);
        assert.match(migrationSql, /'twingate'/);
    });

    test("lists direct and Twingate network profiles", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
        });

        const response = await handleApiRequest(new Request("https://example.com/api/network-profiles"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.profiles, [
            { id: null, slug: "direct", name: "Direct", type: "direct", enabled: true },
            { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: true },
        ]);
    });

    test("updates a monitor network route only to direct or an enabled profile", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [{ id: 42, network_profile_id: null }],
        });

        const twingateResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: "twingate" }),
            }),
            env
        );
        assert.strictEqual(twingateResponse.status, 200);
        assert.deepStrictEqual(await twingateResponse.json(), { ok: true, networkProfileId: "twingate" });
        assert.strictEqual(env.state.monitors[0].network_profile_id, "twingate");

        const directResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: null }),
            }),
            env
        );
        assert.strictEqual(directResponse.status, 200);
        assert.deepStrictEqual(await directResponse.json(), { ok: true, networkProfileId: null });
        assert.strictEqual(env.state.monitors[0].network_profile_id, null);

        const invalidResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: "missing" }),
            }),
            env
        );
        assert.strictEqual(invalidResponse.status, 400);
    });

    test("check-now executes a sanitized monitor job and writes a heartbeat", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    timeout: 5,
                    network_profile_id: "twingate",
                },
            ],
            runnerResult: { status: 1, ping: 12, msg: "200 - OK", response: "ok" },
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, { status: 1, ping: 12, msg: "200 - OK", response: "ok" });
        assert.strictEqual(env.state.runnerJobs.length, 1);
        assert.strictEqual(env.state.runnerJobs[0].networkProfile.slug, "twingate");
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 7,
            status: 1,
            ping: 12,
            msg: "200 - OK",
        });
    });
});

function createEnv(initial) {
    const state = {
        profiles: initial.profiles || [],
        monitors: initial.monitors || [],
        heartbeats: [],
        runnerJobs: [],
        runnerResult: initial.runnerResult,
    };

    return {
        state,
        DB: {
            prepare(sql) {
                return createStatement(sql, state);
            },
        },
        MONITOR_QUEUE: {
            sent: [],
            async send(message) {
                this.sent.push(message);
            },
        },
        RUNNER: {
            get() {
                return {
                    async fetch(request) {
                        state.runnerJobs.push(await request.json());
                        return Response.json(state.runnerResult);
                    },
                };
            },
            idFromName(name) {
                return name;
            },
        },
    };
}

function createStatement(sql, state) {
    const statement = {
        values: [],
        bind(...values) {
            this.values = values;
            return this;
        },
        async all() {
            if (sql.includes("FROM network_profiles")) {
                return { results: state.profiles };
            }
            return { results: [] };
        },
        async first() {
            if (sql.includes("FROM monitors")) {
                const id = Number(this.values[0]);
                return state.monitors.find((monitor) => monitor.id === id) || null;
            }
            if (sql.includes("FROM network_profiles")) {
                const id = this.values[0];
                return state.profiles.find((profile) => profile.id === id && profile.enabled) || null;
            }
            return null;
        },
        async run() {
            if (sql.includes("UPDATE monitors")) {
                const [networkProfileId, id] = this.values;
                const monitor = state.monitors.find((candidate) => candidate.id === Number(id));
                if (monitor) {
                    monitor.network_profile_id = networkProfileId;
                }
                return { success: true };
            }
            if (sql.includes("INSERT INTO heartbeats")) {
                const [monitorId, status, ping, msg] = this.values;
                state.heartbeats.push({
                    monitor_id: Number(monitorId),
                    status,
                    ping,
                    msg,
                });
                return { success: true };
            }
            return { success: true };
        },
    };
    return statement;
}
