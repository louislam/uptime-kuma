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
    return {
        DB: {
            prepare(sql) {
                return {
                    values: [],
                    bind(...values) {
                        this.values = values;
                        return this;
                    },
                    async first() {
                        if (sql.includes("FROM monitors")) {
                            return state.monitors.find((monitor) => monitor.id === Number(this.values[0])) || null;
                        }
                        return null;
                    },
                    async run() {
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
                            ] = this.values;
                            const id = state.nextMonitorId++;
                            state.monitors.push({
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
                            });
                            return { meta: { last_row_id: id } };
                        }
                        if (sql.includes("UPDATE monitors SET")) {
                            const monitor = state.monitors.find((candidate) => candidate.id === Number(this.values.at(-1)));
                            if (monitor) {
                                monitor.name = this.values[0];
                                monitor.type = this.values[1];
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
