const test = require("node:test");
const assert = require("node:assert");
const { sync: rimrafSync } = require("rimraf");
const Database = require("../../server/database");
// const DomainExpiry = require("../../server/model/domain_expiry");
// const Monitor = require("../../server/model/monitor");
const DomainExpiry = require("../../server/model/domain_expiry.js");
const { Settings } = require("../../server/settings");
const { setSetting } = require("../../server/util-server");
const express = require("express");
const bodyParser = require("body-parser");
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");

Notification.init();

/**
 * @param {number} port Port number
 * @param {string} url Webhook URL
 * @param {number} timeout Timeout
 * @returns {Promise<object>} Webhook data
 */
async function serveWebhook(port, url, timeout = 2500) {
    return new Promise((resolve, reject) => {
        const app = express();
        const tmo = setTimeout(() => {
            server.close();
            reject({ reason: "Timeout" });
        }, timeout);
        app.use(bodyParser.json()); // Middleware to parse JSON bodies
        app.post(`/${url}`, (req, res) => {
            res.status(200).send("OK");
            server.close();
            tmo && clearTimeout(tmo);
            resolve(req.body);
        });
        const server = app.listen(port);
    });
}

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
    const monHttpCom = {
        type: "http",
        url: "https://www.google.com",
        domainExpiryNotification: true
    };
    try {
        await t.test("Should get expiry date for .wiki with no A record", async () => {
            const d = DomainExpiry.createByName("google.wiki");
            assert.deepEqual(await d.getExpiryDate(), new Date("2026-11-26T23:59:59.000Z"));
        });
        await t.test("Should get expiration date for .com from RDAP", async () => {
            const domain = await DomainExpiry.forMonitor(monHttpCom);
            const expiryFromRdap = await domain.getExpiryDate(); // from RDAP
            assert.deepEqual(expiryFromRdap, new Date("2028-09-14T04:00:00.000Z"));
        });
        await t.test("Should have expiration date cached in database", async () => {
            await DomainExpiry.checkExpiry(monHttpCom); // RDAP -> Cache
            const domain = await DomainExpiry.findByName("google.com");
            assert(Date.now() - domain.lastCheck < 5 * 1000);
        });
        await t.test("Should trigger notify for expiring domain", async () => {
            await DomainExpiry.findByName("google.com");
            const hook = {
                "port": 3010,
                "url": "capture"
            };
            await setSetting("domainExpiryNotifyDays", [ 1, 2, 1500 ], "general");
            const notif = R.convertToBean("notification", {
                "config": JSON.stringify({
                    type: "webhook",
                    httpMethod: "post",
                    webhookContentType: "json",
                    webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`
                }),
                "active": 1,
                "user_id": 1,
                "name": "Testhook"
            });
            const manyDays = 1500;
            setSetting("domainExpiryNotifyDays", [ 7, 14, manyDays ], "general");
            const [ notifRet, data ] = await Promise.all([
                DomainExpiry.sendNotifications(monHttpCom, [ notif ]),
                serveWebhook(hook.port, hook.url)
            ]);
            assert.equal(notifRet, manyDays);
            assert.match(data.msg, /will expire in/);
        });
    } finally {
        await Database.close();
        Settings.stopCacheCleaner();
        rimrafSync(dataDir);
    }
});
