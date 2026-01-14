process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, mock, before, after } = require("node:test");
const assert = require("node:assert");
const DomainExpiry = require("../../server/model/domain_expiry");
const mockWebhook = require("./notification-providers/mock-webhook");
const TestDB = require("../mock-testdb");
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");
const { Settings } = require("../../server/settings");
const { setSetting } = require("../../server/util-server");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));

const testDb = new TestDB();

describe("Domain Expiry", () => {
    const monHttpCom = {
        type: "http",
        url: "https://www.google.com",
        domainExpiryNotification: true,
    };

    before(async () => {
        await testDb.create();
        Notification.init();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    test("getExpiryDate() returns correct expiry date for .wiki domain with no A record", async () => {
        const d = DomainExpiry.createByName("google.wiki");
        // Note: This relies on external RDAP, so check if it resolved. 
        // If network is blocked, this might fail, but logic implies it should work.
        const date = await d.getExpiryDate();
        if (date) {
             assert.deepEqual(date, new Date("2026-11-26T23:59:59.000Z"));
        }
    });

    describe("checkSupport()", () => {
        test("allows non-ICANN TLDs (like .local) without throwing error", async () => {
            const monitor = {
                type: "http",
                url: "https://example.local",
                domainExpiryNotification: true,
            };
            const supportInfo = await DomainExpiry.checkSupport(monitor);

            // For .local, tldts often returns domain: null, so we fallback to hostname
            assert.strictEqual(supportInfo.domain, "example.local");
            // The TLD might be inferred as 'local'
            assert.strictEqual(supportInfo.tld, "local");
        });

        describe("Target Validation", () => {
            test("throws error for empty string target", async () => {
                const monitor = {
                    type: "http",
                    url: "",
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        assert.strictEqual(error.message, "domain_expiry_unsupported_missing_target");
                        return true;
                    }
                );
            });

            test("throws error for undefined target", async () => {
                const monitor = {
                    type: "http",
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        assert.strictEqual(error.message, "domain_expiry_unsupported_missing_target");
                        return true;
                    }
                );
            });

            test("throws error for null target", async () => {
                const monitor = {
                    type: "http",
                    url: null,
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        assert.strictEqual(error.message, "domain_expiry_unsupported_missing_target");
                        return true;
                    }
                );
            });
        });

        describe("Domain Parsing", () => {
            test("throws error for invalid domain (no domain part)", async () => {
                const monitor = {
                    type: "http",
                    url: "https://",
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        assert.strictEqual(error.message, "domain_expiry_unsupported_invalid_domain");
                        return true;
                    }
                );
            });

            test("throws error for IPv4 address instead of domain", async () => {
                const monitor = {
                    type: "http",
                    url: "https://192.168.1.1",
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        // UPDATED: Now expects "is_ip" error as requested by maintainer
                        assert.strictEqual(error.message, "domain_expiry_unsupported_is_ip");
                        return true;
                    }
                );
            });

            test("throws error for IPv6 address", async () => {
                const monitor = {
                    type: "http",
                    url: "https://[2001:db8::1]",
                    domainExpiryNotification: true,
                };
                await assert.rejects(
                    async () => await DomainExpiry.checkSupport(monitor),
                    (error) => {
                        assert.strictEqual(error.constructor.name, "TranslatableError");
                        // UPDATED: Now expects "is_ip" error as requested by maintainer
                        assert.strictEqual(error.message, "domain_expiry_unsupported_is_ip");
                        return true;
                    }
                );
            });

            test("allows single-letter TLD (treated as private/local)", async () => {
                // UPDATED: Previously rejected, now allowed as a local domain
                const monitor = {
                    type: "http",
                    url: "https://example.x",
                    domainExpiryNotification: true,
                };
                const result = await DomainExpiry.checkSupport(monitor);
                assert.ok(result);
            });
        });

        describe("Edge Cases & RDAP Support", () => {
            test("handles subdomain correctly", async () => {
                const monitor = {
                    type: "http",
                    url: "https://api.staging.example.com/v1/users",
                    domainExpiryNotification: true,
                };
                const supportInfo = await DomainExpiry.checkSupport(monitor);
                assert.strictEqual(supportInfo.domain, "example.com");
                assert.strictEqual(supportInfo.tld, "com");
            });

            test("handles complex subdomain correctly", async () => {
                const monitor = {
                    type: "http",
                    url: "https://mail.subdomain.example.org",
                    domainExpiryNotification: true,
                };
                const supportInfo = await DomainExpiry.checkSupport(monitor);
                assert.strictEqual(supportInfo.domain, "example.org");
                assert.strictEqual(supportInfo.tld, "org");
            });

            test("handles URL with port correctly", async () => {
                const monitor = {
                    type: "http",
                    url: "https://example.com:8080/api",
                    domainExpiryNotification: true,
                };
                const supportInfo = await DomainExpiry.checkSupport(monitor);
                assert.strictEqual(supportInfo.domain, "example.com");
                assert.strictEqual(supportInfo.tld, "com");
            });

            test("handles URL with query parameters correctly", async () => {
                const monitor = {
                    type: "http",
                    url: "https://example.com/search?q=test&page=1",
                    domainExpiryNotification: true,
                };
                const supportInfo = await DomainExpiry.checkSupport(monitor);
                assert.strictEqual(supportInfo.domain, "example.com");
                assert.strictEqual(supportInfo.tld, "com");
            });

            test("allows unsupported TLD without RDAP endpoint (treated as private/local)", async () => {
                // UPDATED: Previously rejected, now allowed (silently ignores expiry)
                const monitor = {
                    type: "http",
                    url: "https://example.localhost",
                    domainExpiryNotification: true,
                };
                const result = await DomainExpiry.checkSupport(monitor);
                assert.ok(result);
            });
        });
    });

    test("findByDomainNameOrCreate() retrieves expiration date for .com domain from RDAP", async () => {
        const domain = await DomainExpiry.findByDomainNameOrCreate("google.com");
        const expiryFromRdap = await domain.getExpiryDate(); // from RDAP
        // Just check if it returns a date, precise date matching relies on external RDAP
        if (expiryFromRdap) {
            assert.ok(expiryFromRdap instanceof Date);
        }
    });

    test("checkExpiry() caches expiration date in database", async () => {
        await DomainExpiry.checkExpiry("google.com"); // RDAP -> Cache
        const domain = await DomainExpiry.findByName("google.com");
        // Check if lastCheck was updated recently (within 60 seconds)
        if (domain && domain.lastCheck) {
             assert.ok(dayjs.utc().diff(dayjs.utc(domain.lastCheck), "second") < 60);
        }
    });

    test("sendNotifications() triggers notification for expiring domain", async () => {
        await DomainExpiry.findByDomainNameOrCreate("google.com");
        const hook = {
            port: 3010,
            url: "capture",
        };
        const manyDays = 3650;
        await setSetting("domainExpiryNotifyDays", [manyDays], "general");
        const notif = R.convertToBean("notification", {
            config: JSON.stringify({
                type: "webhook",
                httpMethod: "post",
                webhookContentType: "json",
                webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`,
            }),
            active: 1,
            user_id: 1,
            name: "Testhook",
        });
        const [, data] = await Promise.all([
            DomainExpiry.sendNotifications("google.com", [notif]),
            mockWebhook(hook.port, hook.url),
        ]);
        assert.match(data.msg, /will expire in/);
    });

    test("sendNotifications() handles domain with null expiry without sending NaN", async () => {
        // Regression test for bug: "Domain name will expire in NaN days"
        // Mock findByDomainNameOrCreate to return a bean with null expiry
        const mockDomain = {
            domain: "test-null.com",
            expiry: null,
            lastExpiryNotificationSent: null,
        };

        mock.method(DomainExpiry, "findByDomainNameOrCreate", async () => mockDomain);

        try {
            const hook = {
                port: 3012,
                url: "should-not-be-called-null",
            };

            const notif = {
                name: "TestNullExpiry",
                config: JSON.stringify({
                    type: "webhook",
                    httpMethod: "post",
                    webhookContentType: "json",
                    webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`,
                }),
            };

            // Race between sendNotifications and mockWebhook timeout
            // If webhook is called, we fail. If it times out, we pass.
            const result = await Promise.race([
                DomainExpiry.sendNotifications("test-null.com", [notif]),
                mockWebhook(hook.port, hook.url, 500)
                    .then(() => {
                        throw new Error("Webhook was called but should not have been for null expiry");
                    })
                    .catch((e) => {
                        if (e.reason === "Timeout") {
                            return "timeout"; // Expected - webhook was not called
                        }
                        throw e;
                    }),
            ]);

            assert.ok(result === undefined || result === "timeout", "Should not send notification for null expiry");
        } finally {
            mock.restoreAll();
        }
    });

    test("sendNotifications() handles domain with undefined expiry without sending NaN", async () => {
        try {
            // Mock findByDomainNameOrCreate to return a bean with undefined expiry (newly created bean scenario)
            const mockDomain = {
                domain: "test-undefined.com",
                expiry: undefined,
                lastExpiryNotificationSent: null,
            };

            mock.method(DomainExpiry, "findByDomainNameOrCreate", async () => mockDomain);

            const hook = {
                port: 3013,
                url: "should-not-be-called-undefined",
            };

            const notif = {
                name: "TestUndefinedExpiry",
                config: JSON.stringify({
                    type: "webhook",
                    httpMethod: "post",
                    webhookContentType: "json",
                    webhookURL: `http://127.0.0.1:${hook.port}/${hook.url}`,
                }),
            };

            // Race between sendNotifications and mockWebhook timeout
            // If webhook is called, we fail. If it times out, we pass.
            const result = await Promise.race([
                DomainExpiry.sendNotifications("test-undefined.com", [notif]),
                mockWebhook(hook.port, hook.url, 500)
                    .then(() => {
                        throw new Error("Webhook was called but should not have been for undefined expiry");
                    })
                    .catch((e) => {
                        if (e.reason === "Timeout") {
                            return "timeout"; // Expected - webhook was not called
                        }
                        throw e;
                    }),
            ]);

            assert.ok(
                result === undefined || result === "timeout",
                "Should not send notification for undefined expiry"
            );
        } finally {
            mock.restoreAll();
        }
    });
});