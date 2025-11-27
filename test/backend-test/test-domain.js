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
    const mon_http_com = {
        type: "http",
        url: "https://www.google.com",
        domainExpiryNotification: true,
    }
    try {
        await t.test("Should get expiry date for .wiki with no A record", async () => {
            const d = DomainExpiry.createByName("google.wiki");
            assert.deepEqual(await d.getExpiryDate(), new Date("2026-11-26T23:59:59.000Z"));
        });
        await t.test("Should get expiration date for .com from RDAP", async () => {
            const domain = await DomainExpiry.forMonitor(mon_http_com);
            const expiryFromRdap = await domain.getExpiryDate(); // from RDAP
            assert.deepEqual(expiryFromRdap, new Date("2028-09-14T04:00:00.000Z"));
        });
        await t.test("Should have expiration date cached in database", async () => {
            await DomainExpiry.checkExpiry(mon_http_com); // RDAP -> Cache
            const domain = await DomainExpiry.findByName("google.com");
            assert(Date.now() - domain.lastCheck < 5 * 1000);
        });
        // TODO: Add more. Cover notification sending etc
    } finally {
        await Database.close();
        Settings.stopCacheCleaner();
        rimrafSync(dataDir);
    }
});
