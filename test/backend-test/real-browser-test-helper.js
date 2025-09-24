const path = require("path");
const { UP, DOWN, PENDING } = require("../../src/util");

/**
 * Real Browser Test Helper
 * Common utilities for testing real browser monitor functionality
 */
class RealBrowserTestHelper {
    /**
     * Constructor for RealBrowserTestHelper
     */
    constructor() {
        this.RealBrowserMonitorType = null;
        this.resetChrome = null;
        this.originalModules = {};
    }

    /**
     * Set up mocks for server dependencies
     * @returns {void}
     */
    setupMocks() {
        const settingsPath = path.resolve(__dirname, "../../server/settings.js");
        const databasePath = path.resolve(__dirname, "../../server/database.js");
        const browserMonitorPath = path.resolve(__dirname, "../../server/monitor-types/real-browser-monitor-type.js");

        // Store originals for cleanup
        this.originalModules.settings = require.cache[settingsPath];
        this.originalModules.database = require.cache[databasePath];
        this.originalModules.browserMonitor = require.cache[browserMonitorPath];

        delete require.cache[settingsPath];
        delete require.cache[databasePath];
        delete require.cache[browserMonitorPath];

        require.cache[settingsPath] = {
            exports: {
                Settings: { get: async (key) => key === "chromeExecutable" ? "#playwright_chromium" : "default" }
            }
        };
        require.cache[databasePath] = {
            exports: { screenshotDir: "/tmp/uptime-kuma-test-screenshots" }
        };

        ({ RealBrowserMonitorType: this.RealBrowserMonitorType, resetChrome: this.resetChrome } = require("../../server/monitor-types/real-browser-monitor-type"));
    }

    /**
     * Clean up mocks and restore original modules
     * @returns {void}
     */
    cleanupMocks() {
        const settingsPath = path.resolve(__dirname, "../../server/settings.js");
        const databasePath = path.resolve(__dirname, "../../server/database.js");
        const browserMonitorPath = path.resolve(__dirname, "../../server/monitor-types/real-browser-monitor-type.js");

        // Remove our mocks
        delete require.cache[settingsPath];
        delete require.cache[databasePath];
        delete require.cache[browserMonitorPath];

        // Restore originals if they existed
        if (this.originalModules.settings) {
            require.cache[settingsPath] = this.originalModules.settings;
        }
        if (this.originalModules.database) {
            require.cache[databasePath] = this.originalModules.database;
        }
        if (this.originalModules.browserMonitor) {
            require.cache[browserMonitorPath] = this.originalModules.browserMonitor;
        }
    }

    /**
     * Create a data URL test server with given content
     * @param {string} content - The HTML content to serve
     * @returns {string} Data URL containing the test page
     */
    createTestServer(content) {
        return `data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>${content}</body></html>`;
    }

    /**
     * Create a monitor configuration object
     * @param {number} id - The monitor ID
     * @param {string} url - The URL to monitor
     * @param {string} keyword - The keyword to search for
     * @param {boolean} invertKeyword - Whether to invert keyword matching
     * @returns {object} Monitor configuration object
     */
    createMonitor(id, url, keyword, invertKeyword = false) {
        return {
            id,
            type: "real-browser",
            url,
            keyword,
            invertKeyword
        };
    }

    /**
     * Run a monitor test and return the heartbeat result
     * @param {object} monitor - The monitor configuration
     * @returns {Promise<object>} The heartbeat object with test results
     */
    async runMonitorTest(monitor) {
        const monitorType = new this.RealBrowserMonitorType();
        const heartbeat = {
            msg: "",
            status: PENDING,
            ping: null
        };
        const server = { jwtSecret: "test-secret-key" };

        try {
            await monitorType.check(monitor, heartbeat, server);
            return heartbeat;
        } catch (error) {
            heartbeat.status = DOWN;
            heartbeat.msg = error.message;
            throw error;
        }
    }

    /**
     * Set up test cleanup hooks
     * @param {object} testSuite - The test suite object
     * @returns {void}
     */
    setupTestCleanup(testSuite) {
        testSuite.after(async () => {
            if (this.resetChrome) {
                await this.resetChrome();
            }
            this.cleanupMocks();
        });
    }

    /**
     * Initialize the test helper with environment and mocks
     * @returns {Promise<void>}
     */
    async initialize() {
        process.env.TEST_BACKEND = "1";
        this.setupMocks();
    }
}

module.exports = {
    RealBrowserTestHelper,
    UP,
    DOWN,
    PENDING
};
