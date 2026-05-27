import { describe, test } from "node:test";
import assert from "node:assert";
import { createMonitor, updateMonitor } from "../../cloudflare/worker/api.mjs";

describe("Worker monitor save with older D1 schema", () => {
    test("creates and updates top-level monitors when the parent column is missing", async () => {
        const state = {
            nextMonitorId: 1,
            monitors: [
                {
                    id: 1,
                    name: "Existing Group",
                    type: "group",
                    url: null,
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: null,
                    body: null,
                    keyword: null,
                    invert_keyword: false,
                    json_path: "$",
                    expected_value: null,
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: null,
                    config_json: null,
                },
            ],
        };
        const env = createLegacyParentEnv(state);

        const groupId = await createMonitor(env, {
            name: "Top Level Group",
            type: "group",
            parent: null,
        });
        await updateMonitor(env, 1, {
            ...state.monitors[0],
            name: "Renamed Group",
            parent: null,
        });

        assert.strictEqual(groupId, 1);
        assert.strictEqual(state.monitors.length, 2);
        assert.strictEqual(state.monitors[0].name, "Renamed Group");
        assert.strictEqual(state.monitors[1].name, "Top Level Group");
        assert.strictEqual("parent" in state.monitors[1], false);
    });
});

/**
 * Create a D1 mock that behaves like a monitors table without a parent column.
 * @param {object} state Mutable monitor state.
 * @returns {object} Minimal Worker environment mock.
 */
function createLegacyParentEnv(state) {
    state.monitorColumns = new Set([
        "id",
        "name",
        "type",
        "url",
        "hostname",
        "port",
        "method",
        "headers",
        "body",
        "keyword",
        "invert_keyword",
        "json_path",
        "expected_value",
        "timeout",
        "interval",
        "active",
        "network_profile_id",
        "config_json",
    ]);

    return {
        DB: {
            prepare(sql) {
                return {
                    values: [],
                    bind(...values) {
                        this.values = values;
                        return this;
                    },
                    async all() {
                        if (sql.includes("PRAGMA table_info(monitors)")) {
                            return {
                                results: [...state.monitorColumns].map((name, cid) => ({ cid, name })),
                            };
                        }
                        return { results: [] };
                    },
                    async first() {
                        if (sql.includes("FROM monitors")) {
                            return state.monitors.find((monitor) => monitor.id === Number(this.values[0])) || null;
                        }
                        return null;
                    },
                    async run() {
                        if (sql.includes("ALTER TABLE monitors ADD COLUMN proxy_id")) {
                            state.monitorColumns.add("proxy_id");
                            for (const monitor of state.monitors) {
                                monitor.proxy_id = monitor.proxy_id ?? null;
                            }
                            return { success: true };
                        }
                        if (sql.includes("CREATE TABLE IF NOT EXISTS proxy")
                            || sql.includes("CREATE INDEX IF NOT EXISTS idx_proxy_default")
                            || sql.includes("CREATE INDEX IF NOT EXISTS idx_monitors_proxy_id")) {
                            return { success: true };
                        }
                        if (/INSERT INTO monitors[\s\S]*parent/.test(sql)) {
                            throw new Error("D1_ERROR: table monitors has no column named parent: SQLITE_ERROR");
                        }
                        if (/UPDATE monitors SET[\s\S]*parent\s*=/.test(sql)) {
                            throw new Error("D1_ERROR: no such column: parent: SQLITE_ERROR");
                        }
                        if (sql.includes("INSERT INTO monitors")) {
                            const [
                                name,
                                type,
                                url,
                                hostname,
                                port,
                                method,
                                headers,
                                body,
                                keyword,
                                invertKeyword,
                                jsonPath,
                                expectedValue,
                                timeout,
                                interval,
                                active,
                                networkProfileId,
                                configJson,
                                proxyId,
                            ] = this.values;
                            const id = state.nextMonitorId++;
                            const row = {
                                id,
                                name,
                                type,
                                url,
                                hostname,
                                port,
                                method,
                                headers,
                                body,
                                keyword,
                                invert_keyword: invertKeyword,
                                json_path: jsonPath,
                                expected_value: expectedValue,
                                timeout,
                                interval,
                                active,
                                network_profile_id: networkProfileId,
                                config_json: configJson,
                            };
                            if (state.monitorColumns.has("proxy_id")) {
                                row.proxy_id = proxyId ?? null;
                            }
                            state.monitors.push(row);
                            return { meta: { last_row_id: id } };
                        }
                        if (sql.includes("UPDATE monitors SET")) {
                            const monitor = state.monitors.find((candidate) => candidate.id === Number(this.values.at(-1)));
                            if (monitor) {
                                monitor.name = this.values[0];
                                monitor.type = this.values[1];
                                if (state.monitorColumns.has("proxy_id")) {
                                    monitor.proxy_id = this.values.at(-2) ?? null;
                                }
                            }
                            return { success: true };
                        }
                        return { success: true };
                    },
                };
            },
        },
    };
}
