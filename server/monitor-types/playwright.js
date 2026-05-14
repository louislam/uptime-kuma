const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { expect } = require("@playwright/test");
const browserRuntime = require("./browser-runtime");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

class PlaywrightMonitorType extends MonitorType {
    name = "playwright";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        this.validateMonitorURL(monitor.url);

        const normalizedScript = this.normalizeScript(monitor.playwright_script);
        const masterTimeoutMs = Math.max(1000, Math.floor(monitor.interval * 1000 * 0.8));
        const actionTimeoutMs = Math.max(1000, Math.floor(monitor.interval * 1000 * 0.4));

        try {
            await this.runScenarioInBand(monitor, normalizedScript, actionTimeoutMs, masterTimeoutMs);
            heartbeat.status = UP;
            heartbeat.msg = "Playwright scenario passed";
        } catch (error) {
            throw new Error(this.formatScenarioError(error));
        }
    }

    /**
     * Executes the scenario in the current process
     */
    async runScenarioInBand(monitor, script, actionTimeoutMs, masterTimeoutMs) {
        const browser = await browserRuntime.getBrowserForMonitor(monitor);
        const context = await browser.newContext();
        context.setDefaultTimeout(actionTimeoutMs);
        context.setDefaultNavigationTimeout(actionTimeoutMs);

        const page = await context.newPage();

        try {
            const scenario = await this.compileScenario(script, monitor, browser, context, page);
            await this.runWithTimeout(scenario({ browser, context, page, monitor }), masterTimeoutMs);
        } finally {
            await context.close();
        }
    }

    /**
     * @param {string} url monitor URL
     * @returns {void}
     */
    validateMonitorURL(url) {
        const parsedURL = new URL(url);
        if (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:") {
            throw new Error("Invalid url protocol, only http and https are allowed.");
        }
    }

    /**
     * @param {string} script monitor script
     * @returns {string} normalized script
     */
    normalizeScript(script) {
        const source = (script || "").trim();
        if (!source) {
            throw new Error("Playwright script is required.");
        }

        // Allow optional BetterStack style import line.
        return source.replace(/^\s*import\s*\{\s*test\s*,\s*expect\s*\}\s*from\s*["']@playwright\/test["'];?\s*/m, "");
    }

    /**
     * @param {string} script normalized monitor script
     * @param {object} monitor monitor bean
     * @param {import("playwright-core").Browser} browser browser instance
     * @param {import("playwright-core").BrowserContext} context browser context
     * @param {import("playwright-core").Page} page browser page
     * @returns {Promise<Function>} compiled monitor scenario function
     */
    async compileScenario(script, monitor, browser, context, page) {
        const tests = [];
        const test = (name, fn) => {
            tests.push({ name, fn });
        };

        const run = new AsyncFunction("test", "expect", "monitor", "browser", "context", "page", script);
        await run(test, expect, monitor, browser, context, page);

        if (tests.length !== 1) {
            throw new Error("Playwright monitor script must define exactly one test(...) block.");
        }

        const scenario = tests[0].fn;
        if (typeof scenario !== "function") {
            throw new Error("Playwright monitor test callback is invalid.");
        }

        return scenario;
    }

    /**
     * @param {Promise<unknown>} promise promise to race
     * @param {number} timeoutMs timeout in ms
     * @returns {Promise<unknown>}
     */
    async runWithTimeout(promise, timeoutMs) {
        let timeoutID;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutID = setTimeout(() => {
                reject(new Error(`Scenario timed out after ${timeoutMs}ms.`));
            }, timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutID);
        }
    }

    /**
     * @param {unknown} error scenario error
     * @returns {string} normalized user-friendly message
     */
    formatScenarioError(error) {
        const rawMessage = this.getErrorMessage(error);
        const withoutAnsi = rawMessage.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
        const actionError = this.formatTypicalActionError(withoutAnsi);
        if (actionError) {
            return `Playwright scenario failed. ${actionError}`;
        }

        const structured = this.formatStructuredAssertionError(error, withoutAnsi);
        if (structured) {
            return `Playwright scenario failed. ${structured}`;
        }

        const withoutCallLog = withoutAnsi.split("Call log:")[0];
        const normalized = withoutCallLog
            .replace(/\s+/g, " ")
            .replace(/\s*([:;,])\s*/g, "$1 ")
            .trim();

        const message = normalized || "Scenario failed.";
        const maxLength = 240;
        const clipped = message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
        return `Playwright scenario failed. ${clipped}`;
    }

    /**
     * @param {string} message ansi-stripped error message
     * @returns {string|null} concise action error, if matched
     */
    formatTypicalActionError(message) {
        const navigationTimeoutMatch = message.match(/^page\.goto:\s*Timeout\s+(\d+)ms exceeded/i);
        if (navigationTimeoutMatch) {
            const url = this.extractQuotedValue(message, /navigating to "([^"]+)"/i);
            if (url) {
                return `Timed out loading ${url} within ${navigationTimeoutMatch[1]}ms`;
            }
            return `Timed out loading page within ${navigationTimeoutMatch[1]}ms`;
        }

        const navigationErrorMatch = message.match(/^page\.goto:\s*(net::[A-Z0-9_]+)\s+at\s+(\S+)/i);
        if (navigationErrorMatch) {
            return `Navigation to ${navigationErrorMatch[2]} failed: ${navigationErrorMatch[1]}`;
        }

        const locatorActionMatch = message.match(
            /^locator\.(click|fill|type|press|check|uncheck|hover|selectOption|dblclick|tap):\s*Timeout\s+(\d+)ms exceeded/i
        );
        if (locatorActionMatch) {
            const locator = this.extractLocatorFromCallLog(message);
            const action = this.humanizeLocatorAction(locatorActionMatch[1]);
            if (locator) {
                return `Timed out trying to ${action} ${locator} within ${locatorActionMatch[2]}ms`;
            }
            return `Timed out trying to ${action} locator within ${locatorActionMatch[2]}ms`;
        }

        if (/strict mode violation/i.test(message)) {
            const locator = this.extractLocatorFromCallLog(message);
            if (locator) {
                return `${locator} matched multiple elements`;
            }
            return "Locator matched multiple elements";
        }

        return null;
    }

    /**
     * @param {unknown} error scenario error
     * @param {string} message ansi-stripped error message
     * @returns {string|null} structured assertion summary, if available
     */
    formatStructuredAssertionError(error, message) {
        const timeoutMatch = message.match(/Timed out\s+(\d+)ms/i);
        const matcherMatch = message.match(/waiting for\s+(expect\([^)]+\)\.[^(]+\([^)]+\))/i);
        const locatorMatch = message.match(/Locator:\s*([\s\S]*?)(?=\s+-\s+Expected|\s+Call log:|$)/i);
        const expectedValue = this.extractExpectedValue(error, message);

        if (!timeoutMatch && !matcherMatch && !locatorMatch && !expectedValue) {
            return null;
        }

        const matcher = matcherMatch?.[1];
        const locator = locatorMatch?.[1]?.replace(/\s+/g, " ").trim();
        const timeout = timeoutMatch?.[1];

        const naturalMessage = this.formatNaturalAssertionError(matcher, locator, expectedValue, timeout);
        if (naturalMessage) {
            return naturalMessage;
        }

        const fragments = [];
        if (matcher) {
            fragments.push(`Assertion ${matcher} failed`);
        }
        if (locator) {
            fragments.push(`locator ${locator}`);
        }
        if (expectedValue) {
            fragments.push(`expected "${expectedValue}"`);
        }
        if (timeout) {
            fragments.push(`timeout ${timeout}ms`);
        }

        return fragments.join(", ");
    }

    /**
     * @param {string|undefined} matcher assertion matcher
     * @param {string|undefined} locator locator description
     * @param {string|null} expectedValue expected value
     * @param {string|undefined} timeout timeout in ms
     * @returns {string|null} natural language assertion message
     */
    formatNaturalAssertionError(matcher, locator, expectedValue, timeout) {
        const timeoutSuffix = timeout ? ` within ${timeout}ms` : "";
        const target = locator || this.resolveTargetFromMatcher(matcher);

        if (matcher?.includes(".toContainText(") && target && expectedValue) {
            return `Expected ${target} to contain text "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveText(") && target && expectedValue) {
            return `Expected ${target} to have text "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveTitle(") && expectedValue) {
            return `Expected page title to match "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveURL(") && expectedValue) {
            return `Expected page URL to match "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveCount(") && target && expectedValue) {
            return `Expected ${target} to have count ${expectedValue}${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveValue(") && target && expectedValue) {
            return `Expected ${target} to have value "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveClass(") && target && expectedValue) {
            return `Expected ${target} to have class "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toHaveAttribute(") && target && expectedValue) {
            return `Expected ${target} to have attribute value "${expectedValue}"${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeVisible(") && target) {
            return `Expected ${target} to be visible${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeHidden(") && target) {
            return `Expected ${target} to be hidden${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeEnabled(") && target) {
            return `Expected ${target} to be enabled${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeDisabled(") && target) {
            return `Expected ${target} to be disabled${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeChecked(") && target) {
            return `Expected ${target} to be checked${timeoutSuffix}`;
        }

        if (matcher?.includes(".toBeEditable(") && target) {
            return `Expected ${target} to be editable${timeoutSuffix}`;
        }

        if (matcher && target) {
            const matcherName = this.extractMatcherName(matcher);
            if (matcherName) {
                if (expectedValue) {
                    return `Expected ${target} to satisfy ${matcherName}("${expectedValue}")${timeoutSuffix}`;
                }
                return `Expected ${target} to satisfy ${matcherName}${timeoutSuffix}`;
            }
        }

        return null;
    }

    /**
     * @param {unknown} error scenario error
     * @param {string} message ansi-stripped error message
     * @returns {string|null} expected assertion value, if detected
     */
    extractExpectedValue(error, message) {
        const objectValue = this.extractExpectedValueFromObject(error);
        if (objectValue) {
            return objectValue;
        }

        const receivedDiffMatch = message.match(/Received\s+\w+\s+\+\s+\d+\s+-\s+(.{1,120}?)\s+\+/i);
        if (receivedDiffMatch) {
            return this.normalizeExpectedValue(receivedDiffMatch[1]);
        }

        const explicitExpectedMatch = message.match(/Expected(?:\s+\w+)?\s*:\s*["']?(.{1,120}?)["']?(?:\s|$)/i);
        if (explicitExpectedMatch) {
            return this.normalizeExpectedValue(explicitExpectedMatch[1]);
        }

        const quotedExpectedMatch = message.match(/Expected(?:\s+\w+)*\s*[-:]?\s*"([^"]{1,120})"/i);
        if (quotedExpectedMatch) {
            return this.normalizeExpectedValue(quotedExpectedMatch[1]);
        }

        const regexExpectedMatch = message.match(/Expected(?:\s+\w+)*\s*[-:]?\s*(\/.{1,120}?\/[gimsuy]*)/i);
        if (regexExpectedMatch) {
            return this.normalizeExpectedValue(regexExpectedMatch[1]);
        }

        return null;
    }

    /**
     * @param {unknown} error scenario error
     * @returns {string|null} expected assertion value from known error object fields
     */
    extractExpectedValueFromObject(error) {
        if (!error || typeof error !== "object") {
            return null;
        }

        const value =
            error?.matcherResult?.expected ??
            error?.expected ??
            error?.matcherResult?.expectedText ??
            error?.actualExpected;

        if (value === undefined || value === null) {
            return null;
        }

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return this.normalizeExpectedValue(String(value));
        }

        return null;
    }

    /**
     * @param {string} value expected value candidate
     * @returns {string|null} normalized expected value
     */
    normalizeExpectedValue(value) {
        const normalized = value.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
        if (!normalized || normalized === "+" || normalized === "-") {
            return null;
        }
        return normalized;
    }

    /**
     * @param {string|undefined} matcher matcher expression
     * @returns {string|null} matcher name without expect(...)
     */
    extractMatcherName(matcher) {
        if (!matcher) {
            return null;
        }

        const match = matcher.match(/\.(to[A-Z][A-Za-z0-9_]*)\(/);
        return match ? match[1] : null;
    }

    /**
     * @param {string|undefined} matcher matcher expression
     * @returns {string|null} fallback target name
     */
    resolveTargetFromMatcher(matcher) {
        if (!matcher) {
            return null;
        }

        if (matcher.startsWith("expect(page).")) {
            return "page";
        }

        if (matcher.startsWith("expect(locator).")) {
            return "locator";
        }

        return null;
    }

    /**
     * @param {string} message full error message
     * @returns {string|null} locator reference from call log or header
     */
    extractLocatorFromCallLog(message) {
        const directMatch = message.match(/Locator:\s*([\s\S]*?)(?=\s+-\s+Expected|\s+Call log:|$)/i);
        if (directMatch?.[1]) {
            return directMatch[1].replace(/\s+/g, " ").trim();
        }

        const callLogMatch = message.match(/waiting for (locator\([^)]+\))/i);
        if (callLogMatch?.[1]) {
            return callLogMatch[1].trim();
        }

        return null;
    }

    /**
     * @param {string} action locator action name
     * @returns {string} human-readable action verb
     */
    humanizeLocatorAction(action) {
        switch (action) {
            case "selectOption":
                return "select an option in";
            case "dblclick":
                return "double-click";
            default:
                return action;
        }
    }

    /**
     * @param {string} message input message
     * @param {RegExp} pattern pattern with first capture group
     * @returns {string|null} captured value
     */
    extractQuotedValue(message, pattern) {
        const match = message.match(pattern);
        return match?.[1] || null;
    }

    /**
     * @param {unknown} error scenario error
     * @returns {string} best-effort error message
     */
    getErrorMessage(error) {
        if (!error) {
            return "";
        }

        if (typeof error === "string") {
            return error;
        }

        if (error instanceof Error) {
            if (typeof error.message === "string" && error.message.length > 0) {
                return error.message;
            }
            return error.toString();
        }

        if (typeof error === "object" && "message" in error && typeof error.message === "string") {
            return error.message;
        }

        return String(error);
    }
}

module.exports = {
    PlaywrightMonitorType,
};
