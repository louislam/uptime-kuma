process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server" ].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");

const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const Monitor = require("../../server/model/monitor");
const { getKnex } = require("../../server/db");

describe("Multi-table writes are atomic (C-2)", () => {
    const testDb = new TestDB("./data/test-monitor-transactions");

    before(() => testDb.create());
    after(() => {
        Settings.stopCacheCleaner();
        return testDb.destroy();
    });

    test("monitor insert + notification link rolls back when the link write throws", async () => {
        const knex = getKnex();

        // Sanity-check: nothing of ours yet.
        const beforeRows = await knex("monitor").where({ name: "tx-rollback-test" });
        assert.strictEqual(beforeRows.length, 0);

        // Mirror the production handler shape:
        //   transaction(trx => { insert; updateMonitorNotification; })
        // but make the second write throw to prove the insert is rolled back.
        await assert.rejects(async () => {
            await knex.transaction(async (trx) => {
                await Monitor.query(trx).insertAndFetch({
                    name: "tx-rollback-test",
                    type: "http",
                    url: "https://example.com/tx-rollback",
                    interval: 60,
                    retry_interval: 10,
                    user_id: null,
                });
                // Simulate a downstream failure (e.g. updateMonitorNotification
                // hitting a constraint or losing connection).
                throw new Error("simulated notification update failure");
            });
        }, /simulated notification update failure/);

        // No orphan monitor row should remain.
        const afterRows = await knex("monitor").where({ name: "tx-rollback-test" });
        assert.strictEqual(afterRows.length, 0, "monitor insert must be rolled back when the trx callback throws");
    });

    test("monitor insert + notification link commits when both succeed", async () => {
        const knex = getKnex();

        let insertedId;
        await knex.transaction(async (trx) => {
            const inserted = await Monitor.query(trx).insertAndFetch({
                name: "tx-commit-test",
                type: "http",
                url: "https://example.com/tx-commit",
                interval: 60,
                retry_interval: 10,
                user_id: null,
            });
            insertedId = inserted.id;
            // Imitate updateMonitorNotification's empty path: do a delete
            // against the link table inside the same trx. No notifications
            // means no inserts, but we still touch the table to confirm the
            // trx wraps both writes.
            await trx("monitor_notification").where("monitor_id", inserted.id).delete();
        });

        const found = await knex("monitor").where("id", insertedId).first();
        assert.ok(found, "monitor row must exist after a successful transaction");
        assert.strictEqual(found.name, "tx-commit-test");
    });

    test("group delete cascade rolls back when a step inside the trx throws", async () => {
        const knex = getKnex();

        // Build a tiny tree: parent group + one child.
        const parent = await Monitor.query().insertAndFetch({
            name: "tx-group-parent",
            type: "group",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });
        const child = await Monitor.query().insertAndFetch({
            name: "tx-group-child",
            type: "http",
            url: "https://example.com/tx-group-child",
            interval: 60,
            retry_interval: 10,
            user_id: null,
            parent: parent.id,
        });

        // Run a transaction that mimics the deleteMonitor cascade in
        // server.js: delete the child row, then throw before the parent
        // delete. Both writes must roll back so neither row disappears.
        // Use raw knex through the trx (instead of Monitor.deleteMonitor)
        // so the test stays focused on transaction semantics and doesn't
        // bring up UptimeKumaServer side effects.
        await assert.rejects(async () => {
            await knex.transaction(async (trx) => {
                await trx("monitor").where("id", child.id).delete();
                throw new Error("simulated cascade failure");
            });
        }, /simulated cascade failure/);

        // Parent and child must both still exist.
        const parentAfter = await knex("monitor").where("id", parent.id).first();
        const childAfter = await knex("monitor").where("id", child.id).first();
        assert.ok(parentAfter, "parent group must still exist after rollback");
        assert.ok(childAfter, "child must still exist after rollback");
        assert.strictEqual(childAfter.parent, parent.id, "child must still be linked to parent after rollback");

        // Confirm a successful trx commits both deletes atomically.
        await knex.transaction(async (trx) => {
            await trx("monitor").where("id", child.id).delete();
            await trx("monitor").where("id", parent.id).delete();
        });
        const parentGone = await knex("monitor").where("id", parent.id).first();
        const childGone = await knex("monitor").where("id", child.id).first();
        assert.strictEqual(parentGone, undefined, "parent must be deleted on commit");
        assert.strictEqual(childGone, undefined, "child must be deleted on commit");
    });

    test("Monitor.unlinkAllChildren respects the trx parameter", async () => {
        const knex = getKnex();

        // Build group + child, then attempt to unlink within a failing trx.
        const parent = await Monitor.query().insertAndFetch({
            name: "tx-unlink-parent",
            type: "group",
            interval: 60,
            retry_interval: 10,
            user_id: null,
        });
        const child = await Monitor.query().insertAndFetch({
            name: "tx-unlink-child",
            type: "http",
            url: "https://example.com/tx-unlink",
            interval: 60,
            retry_interval: 10,
            user_id: null,
            parent: parent.id,
        });

        await assert.rejects(async () => {
            await knex.transaction(async (trx) => {
                await Monitor.unlinkAllChildren(parent.id, trx);
                throw new Error("simulated unlink failure");
            });
        }, /simulated unlink failure/);

        const childAfter = await knex("monitor").where("id", child.id).first();
        assert.strictEqual(childAfter.parent, parent.id, "unlinkAllChildren must roll back when wrapped in a failing trx");

        // Cleanup
        await knex("monitor").whereIn("id", [ child.id, parent.id ]).delete();
    });
});
