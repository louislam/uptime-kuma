const path = require("path");
const { UP, DOWN, PENDING } = require("../../src/util");

/**
 * Real Browser Test Helper
 * Common utilities for testing real browser monitor functionality
 */
class RealBrowserTestHelper {
    /**
     *
     */
    constructor() {
        this.RealBrowserMonitorType = null;
        this.resetChrome = null;
        this.originalModules = {};
    }

    /**
     * Set up mocks for server dependencies
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
     *
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
     * @param content
     */
    createTestServer(content) {
        return `data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>${content}</body></html>`;
    }

    /**
     * @param id
     * @param url
     * @param keyword
     * @param invertKeyword
     */
    createMonitor(id, url, keyword, invertKeyword = false) {
        return { id,
            type: "real-browser",
            url,
            keyword,
            invertKeyword };
    }

    /**
     * @param monitor
     */
    async runMonitorTest(monitor) {
        const monitorType = new this.RealBrowserMonitorType();
        const heartbeat = { msg: "",
            status: PENDING,
            ping: null };
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
     * @param testSuite
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
     *
     */
    async initialize() {
        process.env.TEST_BACKEND = "1";
        this.setupMocks();
    }
}

module.exports = { RealBrowserTestHelper,
    UP,
    DOWN,
    PENDING };
