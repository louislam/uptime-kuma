const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const StatusPage = require("../../server/model/status_page");
const DomainExpiry = require("../../server/model/domain_expiry");
const Monitor = require("../../server/model/monitor");
const {
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_PARTIAL_DOWN,
    STATUS_PAGE_MAINTENANCE,
} = require("../../src/util");

describe("StatusPage", () => {
    describe("getStatusDescription()", () => {
        test("returns 'No Services' when status is -1", () => {
            const description = StatusPage.getStatusDescription(-1);
            assert.strictEqual(description, "No Services");
        });

        test("returns 'All Systems Operational' when all services are up", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_UP);
            assert.strictEqual(description, "All Systems Operational");
        });

        test("returns 'Partially Degraded Service' when some services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_PARTIAL_DOWN);
            assert.strictEqual(description, "Partially Degraded Service");
        });

        test("returns 'Degraded Service' when all services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_DOWN);
            assert.strictEqual(description, "Degraded Service");
        });

        test("returns 'Under maintenance' when status page is in maintenance", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_MAINTENANCE);
            assert.strictEqual(description, "Under maintenance");
        });

        test("returns '?' for unknown status values", () => {
            const description = StatusPage.getStatusDescription(999);
            assert.strictEqual(description, "?");
        });
    });

    describe("public domain expiry", () => {
        test("only includes cached days when enabled, including zero days remaining", async (t) => {
            const monitor = Object.assign(Object.create(Monitor.prototype), {
                id: 1,
                name: "Example",
                type: "http",
                url: "https://www.example.com/health",
            });
            const lookup = t.mock.method(DomainExpiry, "findByName", async (domain) => {
                assert.strictEqual(domain, "example.com");
                return { expiry: new Date(), daysRemaining: 0 };
            });

            assert.ok(!("domainExpiryDaysRemaining" in (await monitor.toPublicJSON())));
            assert.strictEqual(lookup.mock.callCount(), 0);

            const published = await monitor.toPublicJSON(false, false, true);
            assert.strictEqual(published.domainExpiryDaysRemaining, 0);
            assert.ok(!("url" in published));
        });

        test("omits the field for missing data and unsupported targets", async (t) => {
            const monitor = Object.assign(Object.create(Monitor.prototype), {
                type: "http",
                url: "https://example.com",
            });
            const lookup = t.mock.method(DomainExpiry, "findByName", async () => null);

            assert.ok(!("domainExpiryDaysRemaining" in (await monitor.toPublicJSON(false, false, true))));
            monitor.url = "http://127.0.0.1";
            assert.ok(!("domainExpiryDaysRemaining" in (await monitor.toPublicJSON(false, false, true))));
            assert.strictEqual(lookup.mock.callCount(), 1);
        });
    });

    describe("renderRSS()", () => {
        const MOCK_FEED_URL = "http://localhost:3001/status/test";

        test("pubDate uses UTC timezone for heartbeat.time without timezone info", async () => {
            const mockStatusPage = {
                title: "Test Status Page",
            };

            const mockIncidents = [
                {
                    title: "Test Monitor",
                    content: "Test content",
                    id: 1,
                    createdDate: "2026-05-21 15:07:35.600",
                },
            ];

            const mockHeartbeats = [
                {
                    name: "Test Monitor",
                    monitorID: 1,
                    time: "2026-01-24 13:16:25.400",
                },
            ];

            mock.method(StatusPage, "getRSSPageData", async () => ({
                incidents: mockIncidents,
                heartbeats: mockHeartbeats,
                statusDescription: "All Systems Operational",
            }));

            try {
                const rss = await StatusPage.renderRSS(mockStatusPage, MOCK_FEED_URL);

                assert.ok(rss.includes("<pubDate>Sat, 24 Jan 2026 13:16:25 GMT</pubDate>"));
            } finally {
                mock.restoreAll();
            }
        });
    });
});
