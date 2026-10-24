import { test as base, expect } from "@playwright/test";

// Console errors that are expected in the e2e suite and never indicate an app bug.
const IGNORED_CONSOLE_ERRORS = [
    // Failed network requests: several specs point monitors at unreachable or 404 URLs on purpose
    /^Failed to load resource:/,
];

/**
 * Whether a console error is part of the expected noise
 * @param {string} text Console message text
 * @returns {boolean} True when the error should be ignored
 */
function isIgnoredConsoleError(text) {
    return IGNORED_CONSOLE_ERRORS.some((pattern) => pattern.test(text));
}

// Every spec imports this test: a throw in the page (including Vue render errors) or an
// unexpected console error fails that test instead of only showing up in the log.
export const test = base.extend({
    /**
     * Page with an attached browser error guard
     * @param {{ page: import("@playwright/test").Page }} fixtures Fixtures
     * @param {Function} use Fixture use callback
     * @param {import("@playwright/test").TestInfo} testInfo Test info
     * @returns {Promise<void>}
     */
    page: async ({ page }, use, testInfo) => {
        const errors = [];

        page.on("pageerror", (error) => {
            errors.push(`pageerror: ${error.message}`);
        });

        page.on("console", (message) => {
            if (message.type() !== "error") {
                return;
            }
            const text = message.text();
            if (!isIgnoredConsoleError(text)) {
                errors.push(`console: ${text}`);
            }
        });

        await use(page);

        if (errors.length > 0) {
            await testInfo.attach("browser-console-errors", {
                body: errors.join("\n"),
                contentType: "text/plain",
            });
            throw new Error(`Browser reported ${errors.length} error(s):\n${errors.slice(0, 10).join("\n")}`);
        }
    },
});

export { expect };
