process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server" ].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert");
const DomainExpiry = require("../../server/model/domain_expiry");
const mockWebhook = require("./notification-providers/mock-webhook");
const TestDB = require("../mock-testdb");
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");
const { Settings } = require("../../server/settings");
const { setSetting } = require("../../server/util-server");

const testDb = new TestDB();

describe("Domain Expiry", () => {
    const monHttpCom = {
        type: "http",
        url: "https://www.google.com",
        domainExpiryNotification: true
    };

    test("getExpiryDate() returns correct expiry date for .wiki domain with no A record", async () => {
        await testDb.create();
        Notification.init();

        const d = DomainExpiry.createByName("google.wiki");
        assert.deepEqual(await d.getExpiryDate(), new Date("2026-11-26T23:59:59.000Z"));
    });

    test("forMonitor() retrieves expiration date for .com domain from RDAP", async () => {
        const domain = await DomainExpiry.forMonitor(monHttpCom);
        const expiryFromRdap = await domain.getExpiryDate(); // from RDAP
        assert.deepEqual(expiryFromRdap, new Date("2028-09-14T04:00:00.000Z"));
    });

    test("checkExpiry() caches expiration date in database", async () => {
        await DomainExpiry.checkExpiry(monHttpCom); // RDAP -> Cache
        const domain = await DomainExpiry.findByName("google.com");
        assert(Date.now() - domain.lastCheck < 5 * 1000);
    });

    test("sendNotifications() triggers notification for expiring domain", async () => {
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
        const manyDays = 3650;
        setSetting("domainExpiryNotifyDays", [ manyDays ], "general");
        const [ , data ] = await Promise.all([
            DomainExpiry.sendNotifications(monHttpCom, [ notif ]),
            mockWebhook(hook.port, hook.url)
        ]);
        assert.match(data.msg, /will expire in/);

        setTimeout(async () => {
            Settings.stopCacheCleaner();
            await testDb.destroy();
        }, 200);
    });
});
