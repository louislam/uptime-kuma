const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const testDbPath = path.join(__dirname, "../../data/test-group-log-entry.db");

let R;
let GroupLogEntry;

/**
 * Insert a status page and a group on it.
 * @param {object} options Options
 * @param {boolean} options.isPublic Whether the group is public
 * @returns {Promise<{statusPageId: number, groupId: number}>} Ids of the created rows
 */
async function makeStatusPageWithGroup({ isPublic = true } = {}) {
    const statusPage = R.dispense("status_page");
    statusPage.slug = "test-" + Math.random().toString(36).slice(2);
    statusPage.title = "Test Status Page";
    statusPage.icon = "";
    statusPage.theme = "auto";
    await R.store(statusPage);

    const group = R.dispense("group");
    group.name = "Test Group";
    group.public = isPublic;
    group.status_page_id = statusPage.id;
    await R.store(group);

    return { statusPageId: statusPage.id, groupId: group.id };
}

describe("GroupLogEntry", () => {
    before(async () => {
        const testDbDir = path.dirname(testDbPath);
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knex = require("knex");
        const db = knex({
            client: Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        ({ R } = require("redbean-node"));
        R.setup(db);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        GroupLogEntry = require("../../server/model/group_log_entry");
    });

    after(async () => {
        await R.knex.destroy();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    describe("create() / update() / remove()", () => {
        test("creates a manual entry", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            const bean = await GroupLogEntry.create({
                groupId,
                type: "incident",
                title: "Custom note",
                content: "Investigated and resolved.",
            });

            assert.strictEqual(bean.type, "incident");
            assert.strictEqual(bean.source, "manual");
            assert.strictEqual(bean.title, "Custom note");
        });

        test("rejects an invalid type", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            await assert.rejects(
                () => GroupLogEntry.create({ groupId, type: "bogus", title: "t", content: "c" }),
                /Invalid log entry type/
            );
        });

        test("rejects an empty title", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            await assert.rejects(
                () => GroupLogEntry.create({ groupId, type: "maintenance", title: "  ", content: "c" }),
                /Title is required/
            );
        });

        test("rejects an empty content", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            await assert.rejects(
                () => GroupLogEntry.create({ groupId, type: "maintenance", title: "t", content: " " }),
                /Content is required/
            );
        });

        test("rejects an oversized title", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            await assert.rejects(
                () =>
                    GroupLogEntry.create({
                        groupId,
                        type: "maintenance",
                        title: "x".repeat(256),
                        content: "c",
                    }),
                /255 characters or fewer/
            );
        });

        test("update() edits fields when scoped to the correct group", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            const bean = await GroupLogEntry.create({
                groupId,
                type: "maintenance",
                title: "Original",
                content: "Original content",
            });

            const updated = await GroupLogEntry.update(bean.id, groupId, {
                type: "incident",
                title: "Edited",
                content: "Edited content",
            });

            assert.strictEqual(updated.title, "Edited");
            assert.strictEqual(updated.type, "incident");
            assert.ok(updated.updated_date);
        });

        test("update() does nothing across group boundaries", async () => {
            const { groupId: groupA } = await makeStatusPageWithGroup();
            const { groupId: groupB } = await makeStatusPageWithGroup();
            const bean = await GroupLogEntry.create({
                groupId: groupA,
                type: "maintenance",
                title: "Original",
                content: "Original content",
            });

            await assert.rejects(() =>
                GroupLogEntry.update(bean.id, groupB, { type: "incident", title: "Hijacked", content: "c" })
            );

            const row = await R.findOne("group_log_entry", " id = ? ", [bean.id]);
            assert.strictEqual(row.title, "Original");
        });

        test("remove() only deletes within the given group", async () => {
            const { groupId: groupA } = await makeStatusPageWithGroup();
            const { groupId: groupB } = await makeStatusPageWithGroup();
            const bean = await GroupLogEntry.create({
                groupId: groupA,
                type: "maintenance",
                title: "To delete",
                content: "content",
            });

            await GroupLogEntry.remove(bean.id, groupB);
            assert.ok(await R.findOne("group_log_entry", " id = ? ", [bean.id]));

            await GroupLogEntry.remove(bean.id, groupA);
            assert.strictEqual(await R.findOne("group_log_entry", " id = ? ", [bean.id]), null);
        });
    });

    describe("listPublicByGroup()", () => {
        test("returns entries most recent first", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            await GroupLogEntry.create({ groupId, type: "maintenance", title: "First", content: "c" });
            await GroupLogEntry.create({ groupId, type: "incident", title: "Second", content: "c" });

            const list = await GroupLogEntry.listPublicByGroup(groupId);
            assert.strictEqual(list.length, 2);
            assert.strictEqual(list[0].title, "Second");
            assert.strictEqual(list[1].title, "First");
        });

        test("returns an empty list for a private group", async () => {
            const { groupId } = await makeStatusPageWithGroup({ isPublic: false });
            await GroupLogEntry.create({ groupId, type: "maintenance", title: "Hidden", content: "c" });

            const list = await GroupLogEntry.listPublicByGroup(groupId);
            assert.deepStrictEqual(list, []);
        });

        test("returns an empty list for a nonexistent group", async () => {
            const list = await GroupLogEntry.listPublicByGroup(999999);
            assert.deepStrictEqual(list, []);
        });
    });

    describe("createAutoEntriesForIncident()", () => {
        test("creates one entry per public group on the page, none for private groups", async () => {
            const { statusPageId, groupId: publicGroup } = await makeStatusPageWithGroup();

            const privateGroup = R.dispense("group");
            privateGroup.name = "Private";
            privateGroup.public = false;
            privateGroup.status_page_id = statusPageId;
            await R.store(privateGroup);

            await GroupLogEntry.createAutoEntriesForIncident(statusPageId, {
                id: 42,
                title: "Outage",
                content: "Something broke.",
            });

            const publicEntries = await GroupLogEntry.listPublicByGroup(publicGroup);
            assert.strictEqual(publicEntries.length, 1);
            assert.strictEqual(publicEntries[0].type, "incident");
            assert.strictEqual(publicEntries[0].title, "Outage");

            const privateEntries = await R.getAll("SELECT * FROM group_log_entry WHERE group_id = ?", [
                privateGroup.id,
            ]);
            assert.strictEqual(privateEntries.length, 0);
        });

        test("never throws even for a status page that no longer exists", async () => {
            await assert.doesNotReject(() =>
                GroupLogEntry.createAutoEntriesForIncident(999999, { id: 1, title: "t", content: "c" })
            );
        });
    });

    describe("createAutoEntriesForMaintenance()", () => {
        test("creates one entry per distinct public group across all affected monitors", async () => {
            const { groupId: groupA } = await makeStatusPageWithGroup();
            const { groupId: groupB } = await makeStatusPageWithGroup();

            const monitorA = R.dispense("monitor");
            monitorA.name = "Monitor A";
            monitorA.type = "http";
            await R.store(monitorA);

            const monitorB = R.dispense("monitor");
            monitorB.name = "Monitor B";
            monitorB.type = "http";
            await R.store(monitorB);

            // Both monitors belong to groupA (should be deduped to one entry);
            // monitorB also belongs to groupB.
            for (const [monitorId, groupId] of [
                [monitorA.id, groupA],
                [monitorB.id, groupA],
                [monitorB.id, groupB],
            ]) {
                const rel = R.dispense("monitor_group");
                rel.monitor_id = monitorId;
                rel.group_id = groupId;
                await R.store(rel);
            }

            await GroupLogEntry.createAutoEntriesForMaintenance(
                { id: 7, title: "Router upgrade", description: "Brief blip expected." },
                [ monitorA.id, monitorB.id ]
            );

            const entriesA = await GroupLogEntry.listPublicByGroup(groupA);
            assert.strictEqual(entriesA.length, 1);
            assert.strictEqual(entriesA[0].type, "maintenance");

            const entriesB = await GroupLogEntry.listPublicByGroup(groupB);
            assert.strictEqual(entriesB.length, 1);
        });

        test("never throws for an empty monitor list", async () => {
            await assert.doesNotReject(() =>
                GroupLogEntry.createAutoEntriesForMaintenance({ id: 1, title: "t" }, [])
            );
        });
    });

    // maintenance-socket-handler.js's addMonitorMaintenance guards the
    // one-time subscriber notification with an atomic
    // `UPDATE maintenance SET subscriber_notified = true WHERE subscriber_notified = false`
    // claim rather than a read-then-write, specifically to avoid a
    // double-send if the event fires twice in quick succession. This
    // exercises that exact SQL pattern directly (rather than the full
    // socket handler, which pulls in the UptimeKumaServer singleton) to
    // confirm only one of two back-to-back attempts can ever claim it.
    describe("maintenance.subscriber_notified atomic claim", () => {
        test("only one of two concurrent claim attempts succeeds", async () => {
            const bean = R.dispense("maintenance");
            bean.title = "Race test";
            bean.description = "d";
            bean.strategy = "manual";
            bean.subscriber_notified = false;
            const maintenanceId = await R.store(bean);

            const claim = () =>
                R.knex("maintenance")
                    .where({ id: maintenanceId, subscriber_notified: false })
                    .update({ subscriber_notified: true });

            const [ first, second ] = await Promise.all([ claim(), claim() ]);

            assert.strictEqual(first + second, 1);
        });

        test("a maintenance already marked notified cannot be re-claimed", async () => {
            const bean = R.dispense("maintenance");
            bean.title = "Already notified";
            bean.description = "d";
            bean.strategy = "manual";
            bean.subscriber_notified = true;
            const maintenanceId = await R.store(bean);

            const claimed = await R.knex("maintenance")
                .where({ id: maintenanceId, subscriber_notified: false })
                .update({ subscriber_notified: true });

            assert.strictEqual(claimed, 0);
        });
    });
});
