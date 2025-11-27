const test = require("node:test");
const assert = require("node:assert");
const { sync: rimrafSync } = require("rimraf");
const Database = require("../../server/database");
// const DomainExpiry = require("../../server/model/domain_expiry");
// const Monitor = require("../../server/model/monitor");
const DomainExpiry = require("../../server/model/domain_expiry.js");
const { Settings } = require("../../server/settings");

/**
 * Initiatates and migrates a test database
 * @returns {string} Path to test data
 */
async function createTestDb() {
    const dataDir = "./data/test";
    Database.initDataDir({ "data-dir": dataDir });
    Database.dbConfig = {
        type: "sqlite"
    };
    Database.writeDBConfig(Database.dbConfig);
    await Database.connect(true);
    await Database.patch();
    return dataDir;
}

test("Test with mock db", async (t) => {
    const dataDir = await createTestDb();
    try {
        await t.test("Test expiry date acquisition .wiki", async () => {
            const d = DomainExpiry.createByName("google.wiki");
            assert.deepEqual(await d.getExpiryDate(), new Date("2026-11-26T23:59:59.000Z"));
        });
        await t.test("Should get expiration date for .com from RDAP", async () => {
            const monitor = {
                type: "http",
                url: "https://www.google.com",
                domainExpiryNotification: true,
            };
            const domain = await DomainExpiry.forMonitor(monitor);
            const expiryFromRdap = await domain.getExpiryDate(monitor);
            assert.deepEqual(expiryFromRdap, new Date("2028-09-14T04:00:00.000Z"));
        });
        // TODO: Add more. Cover notification sending etc
    } finally {
        await Database.close();
        Settings.stopCacheCleaner();
        rimrafSync(dataDir);
    }
});
