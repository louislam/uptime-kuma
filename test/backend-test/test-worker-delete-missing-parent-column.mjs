import { describe, test } from "node:test";
import assert from "node:assert";
import { deleteMonitor } from "../../cloudflare/worker/api.mjs";

describe("Worker monitor deletion with older D1 schema", () => {
    test("deletes a monitor when the parent column has not been migrated yet", async () => {
        const state = {
            monitors: [
                { id: 5, name: "Legacy Monitor", type: "http" },
            ],
            heartbeats: [
                { monitor_id: 5, status: 1 },
            ],
        };
        const env = {
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
                            if (sql.includes("DELETE FROM heartbeats")) {
                                state.heartbeats = state.heartbeats.filter(
                                    (heartbeat) => heartbeat.monitor_id !== Number(this.values[0])
                                );
                                return { success: true };
                            }
                            if (sql.includes("SET parent = NULL")) {
                                throw new Error("D1_ERROR: no such column: parent: SQLITE_ERROR");
                            }
                            if (sql.includes("DELETE FROM monitors")) {
                                state.monitors = state.monitors.filter((monitor) => monitor.id !== Number(this.values[0]));
                                return { success: true };
                            }
                            return { success: true };
                        },
                    };
                },
            },
        };

        await deleteMonitor(env, 5);

        assert.deepStrictEqual(state.monitors, []);
        assert.deepStrictEqual(state.heartbeats, []);
    });
});
