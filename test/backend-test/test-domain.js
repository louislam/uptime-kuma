process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server" ].join(",");

const { describe, test, mock } = require("node:test");
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

    test("sendNotifications() handles domain with null expiry without sending NaN", async () => {
        // Regression test for bug: "Domain name will expire in NaN days"
        // Mock forMonitor to return a bean with null expiry
        const mockDomain = {
            domain: "test-null.com",
            expiry: null,
            lastExpiryNotificationSent: null
        };

        mock.method(DomainExpiry, "forMonitor", async () => mockDomain);

        const hook = {
            "port": 3012,
            "url": "should-not-be-called-null"
        };

        const monTest = {
            type: "http",
            url: "https://test-null.com",
            domainExpiryNotification: true
        };

        const notif = {
            name: "TestNullExpiry",
            config: JSON.stringify({
                type: "webhook",
                httpMethod: "post",
                webhookContentType: "json",
                webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`
            })
        };

        // Race between sendNotifications and mockWebhook timeout
        // If webhook is called, we fail. If it times out, we pass.
        const result = await Promise.race([
            DomainExpiry.sendNotifications(monTest, [ notif ]),
            mockWebhook(hook.port, hook.url, 500).then(() => {
                throw new Error("Webhook was called but should not have been for null expiry");
            }).catch((e) => {
                if (e.reason === "Timeout") {
                    return "timeout"; // Expected - webhook was not called
                }
                throw e;
            })
        ]);

        assert.ok(result === undefined || result === "timeout", "Should not send notification for null expiry");
    });

    test("sendNotifications() handles domain with undefined expiry without sending NaN", async () => {
        // Mock forMonitor to return a bean with undefined expiry (newly created bean scenario)
        const mockDomain = {
            domain: "test-undefined.com",
            expiry: undefined,
            lastExpiryNotificationSent: null
        };

        mock.method(DomainExpiry, "forMonitor", async () => mockDomain);

        const hook = {
            "port": 3013,
            "url": "should-not-be-called-undefined"
        };

        const monTest = {
            type: "http",
            url: "https://test-undefined.com",
            domainExpiryNotification: true
        };

        const notif = {
            name: "TestUndefinedExpiry",
            config: JSON.stringify({
                type: "webhook",
                httpMethod: "post",
                webhookContentType: "json",
                webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`
            })
        };

        // Race between sendNotifications and mockWebhook timeout
        // If webhook is called, we fail. If it times out, we pass.
        const result = await Promise.race([
            DomainExpiry.sendNotifications(monTest, [ notif ]),
            mockWebhook(hook.port, hook.url, 500).then(() => {
                throw new Error("Webhook was called but should not have been for undefined expiry");
            }).catch((e) => {
                if (e.reason === "Timeout") {
                    return "timeout"; // Expected - webhook was not called
                }
                throw e;
            })
        ]);

        assert.ok(result === undefined || result === "timeout", "Should not send notification for undefined expiry");
    });
});
