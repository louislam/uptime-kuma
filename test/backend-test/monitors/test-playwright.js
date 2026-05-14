const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { UP, PENDING } = require("../../../src/util");
const { PlaywrightMonitorType } = require("../../../server/monitor-types/playwright");
const browserRuntime = require("../../../server/monitor-types/browser-runtime");

/**
 * @returns {Promise<{ server: import("node:http").Server, url: string }>}
 */
async function createTinyHttpPage() {
    const server = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><head><title>Tiny Test Page</title></head><body>ok</body></html>");
    });

    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
    };
}

/**
 * @returns {{
 *   browser: { newContext: () => Promise<any> },
 *   page: { goto: (url: string) => Promise<any> }
 * }}
 */
function createBrowserStub() {
    const page = {
        async goto(url) {
            const response = await fetch(url);
            return {
                status() {
                    return response.status;
                },
                ok() {
                    return response.ok;
                },
            };
        },
    };

    const context = {
        timeoutSet: 0,
        navigationTimeoutSet: 0,
        async newPage() {
            return page;
        },
        async close() {},
        setDefaultTimeout(t) {
            this.timeoutSet = t;
        },
        setDefaultNavigationTimeout(t) {
            this.navigationTimeoutSet = t;
        },
    };

    const browser = {
        async newContext() {
            return context;
        },
    };

    return { browser, context, page };
}

describe("Playwright Monitor", () => {
    test("check() marks monitor UP for passing scenario", async (t) => {
        const monitorType = new PlaywrightMonitorType();
        const { server, url } = await createTinyHttpPage();
        t.after(() => server.close());

        const { browser } = createBrowserStub();
        const runtimeMock = mock.method(browserRuntime, "getBrowserForMonitor", async () => browser);
        t.after(() => runtimeMock.mock.restore());

        const monitor = {
            url,
            interval: 60,
            playwright_script: `test("status is 200", async ({ page }) => {
                const response = await page.goto(monitor.url);
                expect(response.status()).toBe(200);
            });`,
        };

        const heartbeat = {
            status: PENDING,
            msg: "",
        };

        await monitorType.check(monitor, heartbeat, {});
        assert.strictEqual(heartbeat.status, UP);
        assert.strictEqual(heartbeat.msg, "Playwright scenario passed");
    });

    test("check() throws for failing scenario", async (t) => {
        const monitorType = new PlaywrightMonitorType();
        const { server, url } = await createTinyHttpPage();
        t.after(() => server.close());

        const { browser } = createBrowserStub();
        const runtimeMock = mock.method(browserRuntime, "getBrowserForMonitor", async () => browser);
        t.after(() => runtimeMock.mock.restore());

        const monitor = {
            url,
            interval: 60,
            playwright_script: `test("status fails", async ({ page }) => {
                const response = await page.goto(monitor.url);
                expect(response.status()).toBe(500);
            });`,
        };

        const heartbeat = {
            status: PENDING,
            msg: "",
        };

        await assert.rejects(() => monitorType.check(monitor, heartbeat, {}));
    });

    test("check() sets correct internal timeouts for Playwright context", async (t) => {
        const monitorType = new PlaywrightMonitorType();
        const { server, url } = await createTinyHttpPage();
        t.after(() => server.close());

        const { browser, context } = createBrowserStub();
        const runtimeMock = mock.method(browserRuntime, "getBrowserForMonitor", async () => browser);
        t.after(() => runtimeMock.mock.restore());

        const monitor = {
            url,
            interval: 60, // 60 seconds
            playwright_script: `test("dummy", async () => {});`,
        };

        const heartbeat = {
            status: PENDING,
            msg: "",
        };

        await monitorType.check(monitor, heartbeat, {});
        
        // 40% of 60 seconds (60000ms) = 24000ms
        assert.strictEqual(context.timeoutSet, 24000);
        assert.strictEqual(context.navigationTimeoutSet, 24000);
    });


    test("formatScenarioError() returns concise assertion summary", () => {
        const monitorType = new PlaywrightMonitorType();
        const error = new Error(
            "Timed out 5000ms waiting for expect(locator).toContainText(expected) " +
                "Locator: locator('#welcome-banner') - Expected string - 1 + Received string + 7 - Welcome + + +"
        );

        const formatted = monitorType.formatScenarioError(error);
        assert.strictEqual(
            formatted,
            `Playwright scenario failed. Expected locator('#welcome-banner') to contain text "Welcome" within 5000ms`
        );
    });

    test("formatScenarioError() summarizes page URL assertions", () => {
        const monitorType = new PlaywrightMonitorType();
        const error = new Error(
            'Timed out 5000ms waiting for expect(page).toHaveURL(expected) Expected string: "https://example.com/ok"'
        );

        const formatted = monitorType.formatScenarioError(error);
        assert.strictEqual(formatted, 'Playwright scenario failed. Expected page URL to match "https://example.com/ok" within 5000ms');
    });

    test("formatScenarioError() summarizes page.goto timeout", () => {
        const monitorType = new PlaywrightMonitorType();
        const error = new Error(
            'page.goto: Timeout 30000ms exceeded. Call log: - navigating to "https://example.com/", waiting until "load"'
        );

        const formatted = monitorType.formatScenarioError(error);
        assert.strictEqual(formatted, "Playwright scenario failed. Timed out loading https://example.com/ within 30000ms");
    });

    test("formatScenarioError() summarizes locator click timeout", () => {
        const monitorType = new PlaywrightMonitorType();
        const error = new Error(
            "locator.click: Timeout 30000ms exceeded. Call log: - waiting for locator('#submit-button')"
        );

        const formatted = monitorType.formatScenarioError(error);
        assert.strictEqual(formatted, "Playwright scenario failed. Timed out trying to click locator('#submit-button') within 30000ms");
    });
});
