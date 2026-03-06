const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const StatusPage = require("../../server/model/status_page");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const {
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_PARTIAL_DOWN,
    STATUS_PAGE_MAINTENANCE,
} = require("../../src/util");

dayjs.extend(utc);

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

    describe("renderRSS()", () => {
        const MOCK_FEED_URL = "http://localhost:3001/status/test";

        test("pubDate uses UTC timezone for heartbeat.time without timezone info", async () => {
            const mockStatusPage = {
                title: "Test Status Page",
            };

            const mockHeartbeats = [
                {
                    name: "Test Monitor",
                    monitorID: 1,
                    time: "2026-01-24 13:16:25.400",
                },
            ];

            mock.method(StatusPage, "getRSSPageData", async () => ({
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
