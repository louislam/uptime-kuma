const test = require("node:test");
const assert = require("node:assert");
const sharp = require("sharp");
const StatusPage = require("../../server/model/status_page");
const { generateOGImageSVG, getStatusColor, escapeXml } = require("../../server/utils/og-image");
const fs = require("fs");
const path = require("path");
const {
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_PARTIAL_DOWN,
    STATUS_PAGE_ALL_DOWN,
    MAINTENANCE
} = require("../../src/util");

const SNAPSHOTS_DIR = path.join(__dirname, "snapshots", "og-images");

// Ensure snapshots directory exists
if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// Fixed timestamp for consistent snapshots (2024-01-01 00:00:00 UTC)
const FIXED_TIMESTAMP = 1704067200000;

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SCENARIOS = [
    {
        name: "all-up",
        title: "Production",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 8
    },
    {
        name: "all-down",
        title: "Infrastructure",
        statusCode: STATUS_PAGE_ALL_DOWN,
        monitorCount: 6
    },
    {
        name: "maintenance",
        title: "Maintenance",
        statusCode: MAINTENANCE,
        monitorCount: 3
    },
    {
        name: "partial",
        title: "API Services",
        statusCode: STATUS_PAGE_PARTIAL_DOWN,
        monitorCount: 12
    },
    {
        name: "all-up-many-monitors",
        title: "Enterprise",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 200
    },
    {
        name: "all-up-no-branding",
        title: "Production",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 8,
        showPoweredBy: false
    },
    {
        name: "all-up-custom-icon-no-branding",
        title: "Production",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 8,
        icon: "/icon.svg",
        showPoweredBy: false
    },
    {
        name: "all-up-custom-icon-with-branding",
        title: "Production",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 8,
        icon: "/icon.svg",
        showPoweredBy: true
    },
    {
        name: "all-up-long-title",
        title: "This is an extremely long status page title that will need to be truncated",
        statusCode: STATUS_PAGE_ALL_UP,
        monitorCount: 5
    }
];

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Compare SVG with snapshot, create if doesn't exist
 * @param {string} svg SVG content
 * @param {string} snapshotName Snapshot filename
 * @returns {void}
 */
function assertMatchesSnapshot(svg, snapshotName) {
    const snapshotPath = path.join(SNAPSHOTS_DIR, snapshotName);

    if (fs.existsSync(snapshotPath)) {
        const snapshot = fs.readFileSync(snapshotPath, "utf8");
        assert.strictEqual(svg, snapshot, `SVG should match snapshot: ${snapshotName}`);
    } else {
        fs.writeFileSync(snapshotPath, svg, "utf8");
        console.log(`Created snapshot: ${snapshotName}`);
    }
}

/**
 * Creates a mock status page with RSS data
 * @param {object} overrides Override default values
 * @param {object} rssData RSS data to return
 * @returns {object} Mock status page and cleanup function
 */
function createMockStatusPage(overrides = {}, rssData = null) {
    const mockPage = {
        id: 1,
        slug: "test",
        title: "Test Page",
        description: "Test Description",
        ...overrides
    };

    const originalGetRSSData = StatusPage.getRSSPageData;

    if (rssData) {
        StatusPage.getRSSPageData = async () => rssData;
    }

    const cleanup = () => {
        StatusPage.getRSSPageData = originalGetRSSData;
    };

    return { mockPage,
        cleanup };
}

/**
 * Verify PNG buffer structure and metadata
 * @param {Buffer} buffer PNG buffer to verify
 * @returns {Promise<void>}
 */
async function assertValidPNG(buffer) {
    assert.ok(buffer instanceof Buffer, "Should return a Buffer");
    assert.ok(buffer.length > 0, "Buffer should not be empty");

    // Check PNG signature (first 8 bytes)
    const pngSignature = Buffer.from([ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ]);
    const actualSignature = buffer.slice(0, 8);
    assert.deepStrictEqual(
        actualSignature,
        pngSignature,
        "Should have valid PNG signature"
    );

    // Use sharp to verify metadata
    const metadata = await sharp(buffer).metadata();
    assert.strictEqual(metadata.format, "png", "Should be PNG format");
    assert.strictEqual(metadata.width, 1200, "Should have width 1200");
    assert.strictEqual(metadata.height, 630, "Should have height 630");
}

// ============================================================================
// Unit Tests - Helper Functions
// ============================================================================

test("escapeXml()", async (t) => {

    await t.test("should escape all XML special characters", () => {
        assert.strictEqual(escapeXml("&"), "&amp;");
        assert.strictEqual(escapeXml("<"), "&lt;");
        assert.strictEqual(escapeXml(">"), "&gt;");
        assert.strictEqual(escapeXml("\""), "&quot;");
        assert.strictEqual(escapeXml("'"), "&apos;");
    });

    await t.test("should handle mixed special characters", () => {
        const input = "Company & Services <Status> \"Test\" 'Quote'";
        const expected = "Company &amp; Services &lt;Status&gt; &quot;Test&quot; &apos;Quote&apos;";
        assert.strictEqual(escapeXml(input), expected);
    });
});

test("getStatusColor()", async (t) => {

    await t.test("should return green for all systems up", () => {
        assert.strictEqual(getStatusColor(STATUS_PAGE_ALL_UP), "#10b981");
    });

    await t.test("should return yellow for partial degradation", () => {
        assert.strictEqual(getStatusColor(STATUS_PAGE_PARTIAL_DOWN), "#f59e0b");
    });

    await t.test("should return red for all systems down", () => {
        assert.strictEqual(getStatusColor(STATUS_PAGE_ALL_DOWN), "#ef4444");
    });

    await t.test("should return blue for maintenance", () => {
        assert.strictEqual(getStatusColor(MAINTENANCE), "#3b82f6");
    });

    await t.test("should return gray for no services", () => {
        assert.strictEqual(getStatusColor(-1), "#6b7280");
    });
});

test("StatusPage.overallStatus()", async (t) => {

    await t.test("should return -1 for empty heartbeats", () => {
        const status = StatusPage.overallStatus([]);
        assert.strictEqual(status, -1);
    });

    await t.test("should return ALL_UP when all monitors are up", () => {
        const status = StatusPage.overallStatus([{ status: 1 }, { status: 1 }]);
        assert.strictEqual(status, STATUS_PAGE_ALL_UP);
    });

    await t.test("should return PARTIAL_DOWN when monitors are mixed", () => {
        const status = StatusPage.overallStatus([{ status: 1 }, { status: 0 }]);
        assert.strictEqual(status, STATUS_PAGE_PARTIAL_DOWN);
    });

    await t.test("should return ALL_DOWN when all monitors are down", () => {
        const status = StatusPage.overallStatus([{ status: 0 }, { status: 0 }]);
        assert.strictEqual(status, STATUS_PAGE_ALL_DOWN);
    });
});

test("StatusPage.getStatusDescription()", async (t) => {

    await t.test("should return description for no services", () => {
        assert.strictEqual(StatusPage.getStatusDescription(-1), "No Services");
    });

    await t.test("should return description for all systems operational", () => {
        assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_ALL_UP), "All Systems Operational");
    });

    await t.test("should return description for partially degraded", () => {
        assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_PARTIAL_DOWN), "Partially Degraded Service");
    });

    await t.test("should return description for degraded service", () => {
        assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_ALL_DOWN), "Degraded Service");
    });

    await t.test("should return description for maintenance", () => {
        assert.strictEqual(StatusPage.getStatusDescription(MAINTENANCE), "Under maintenance");
    });
});

// ============================================================================
// Basic Structure Tests
// ============================================================================

test("generateOGImageSVG() - basic structure", async (t) => {

    await t.test("should generate valid SVG with required elements", () => {
        const svg = generateOGImageSVG(
            "Test",
            "All OK",
            "#10b981",
            null,
            true,
            FIXED_TIMESTAMP,
            Array(5).fill({})
        );

        assert.ok(svg.startsWith("<?xml"), "Should start with XML declaration");
        assert.ok(svg.includes("xmlns=\"http://www.w3.org/2000/svg\""), "Should have SVG namespace");
        assert.ok(svg.includes("width=\"1200\""), "Should have width 1200");
        assert.ok(svg.includes("height=\"630\""), "Should have height 630");
        assert.ok(svg.includes("</svg>"), "Should have closing svg tag");
    });
});

// ============================================================================
// Snapshot Tests - Comprehensive Scenarios
// ============================================================================

test("generateOGImageSVG() snapshots - all scenarios", async (t) => {

    await t.test("all test scenarios", () => {
        TEST_SCENARIOS.forEach((scenario) => {
            const statusDescription = StatusPage.getStatusDescription(scenario.statusCode);
            const statusColor = getStatusColor(scenario.statusCode);
            const icon = scenario.icon || null;
            const showPoweredBy = scenario.showPoweredBy !== undefined ? scenario.showPoweredBy : true;

            // For scenarios with many monitors (>3), show status count summary
            // Otherwise show individual monitors or total count
            let monitors;
            if (scenario.monitorCount > 3) {
                // Create realistic monitor mix for status summary
                monitors = [];
                const upCount = Math.floor(scenario.monitorCount * 0.85); // 85% up
                const downCount = Math.floor(scenario.monitorCount * 0.10); // 10% down
                const maintenanceCount = Math.floor(scenario.monitorCount * 0.03); // 3% maintenance
                const pendingCount = scenario.monitorCount - upCount - downCount - maintenanceCount; // Rest pending

                for (let i = 0; i < upCount; i++) {
                    monitors.push({ name: `Monitor ${i + 1}`,
                        status: 1 });
                }
                for (let i = 0; i < downCount; i++) {
                    monitors.push({ name: `Monitor ${upCount + i + 1}`,
                        status: 0 });
                }
                for (let i = 0; i < maintenanceCount; i++) {
                    monitors.push({ name: `Monitor ${upCount + downCount + i + 1}`,
                        status: 3 });
                }
                for (let i = 0; i < pendingCount; i++) {
                    monitors.push({ name: `Monitor ${upCount + downCount + maintenanceCount + i + 1}`,
                        status: 2 });
                }
            } else {
                monitors = Array(scenario.monitorCount).fill({}); // Show count
            }

            const svg = generateOGImageSVG(
                scenario.title,
                statusDescription,
                statusColor,
                icon,
                showPoweredBy,
                FIXED_TIMESTAMP,
                monitors
            );
            assertMatchesSnapshot(svg, `${scenario.name}.svg`);
        });
    });
});

// ============================================================================
// Integration Tests - PNG Conversion
// ============================================================================

test("StatusPage.generateOGImage() - PNG conversion", async (t) => {

    await t.test("should convert SVG to valid PNG", async () => {
        const { mockPage, cleanup } = createMockStatusPage(
            { title: "Test Page" },
            {
                heartbeats: [{ status: 1 }],
                statusDescription: "All Systems Operational"
            }
        );

        try {
            const buffer = await StatusPage.generateOGImage(mockPage);
            await assertValidPNG(buffer);
        } finally {
            cleanup();
        }
    });

    await t.test("should generate PNG with reasonable file size", async () => {
        const { mockPage, cleanup } = createMockStatusPage(
            {},
            {
                heartbeats: [{ status: 1 }],
                statusDescription: "All Systems Operational"
            }
        );

        try {
            const buffer = await StatusPage.generateOGImage(mockPage);
            assert.ok(buffer.length < 100 * 1024, "PNG should be less than 100KB");
            assert.ok(buffer.length > 1000, "PNG should be more than 1KB");
        } finally {
            cleanup();
        }
    });

    await t.test("should handle different status page configurations", async () => {
        const { mockPage, cleanup } = createMockStatusPage(
            {
                title: "Production",
                show_powered_by: false,
                icon: "/icon.svg"
            },
            {
                heartbeats: [{ status: 1 }, { status: 0 }],
                statusDescription: "Partially Degraded Service"
            }
        );

        try {
            const buffer = await StatusPage.generateOGImage(mockPage);
            await assertValidPNG(buffer);
        } finally {
            cleanup();
        }
    });
});
