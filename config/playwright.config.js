import { defineConfig, devices } from "@playwright/test";

const port = 30001;
export const url = `http://localhost:${port}`;

export default defineConfig({
    // Look for test files in the "tests" directory, relative to this configuration file.
    testDir: "../test/e2e/specs",
    outputDir: "../private/playwright-test-results",
    fullyParallel: false,
    locale: "en-US",

    // Fail the build on CI if you accidentally left test.only in the source code.
    forbidOnly: !!process.env.CI,

    // Retry on CI only.
    retries: process.env.CI ? 2 : 0,

    // Opt out of parallel tests on CI.
    workers: 1,

    // Reporter to use
    reporter: [
        [
            "html", {
                outputFolder: "../private/playwright-report",
                open: "never",
            }
        ],
    ],

    use: {
        // Base URL to use in actions like `await page.goto('/')`.
        baseURL: url,

        // Collect trace when retrying the failed test.
        trace: "on-first-retry",
    },

    // Configure projects for major browsers.
    projects: [
        {
            name: "run-once setup",
            testMatch: /setup-process\.once\.js/,
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "specs",
            use: { ...devices["Desktop Chrome"] },
            dependencies: [ "run-once setup" ],
        },
        /*
        {
            name: "firefox",
            use: { browserName: "firefox" }
        },*/
    ],

    // Run your local dev server before starting the tests.
    webServer: {
        command: `node extra/remove-playwright-test-data.js && cross-env NODE_ENV=development node server/server.js --port=${port} --data-dir=./data/playwright-test`,
        url,
        reuseExistingServer: false,
        cwd: "../",
    },
});
