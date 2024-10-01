import { screenshot, login } from "../util-test";
import { expect } from "@playwright/test";

/**
 * Represents a Monitor Form page with actions related to monitor management.
 */
export class MonitorForm {
    /**
     * @param {import('@playwright/test').Page} page - The Playwright page object.
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Navigates to the add monitor page.
     * @returns {Promise<void>}
     */
    async navigateToAddPage() {
        await this.page.goto("./add");
    }

    /**
     * Logs in and takes a screenshot.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information.
     * @returns {Promise<void>}
     */
    async login(testInfo) {
        await login(this.page);
        await screenshot(testInfo, this.page);
    }

    /**
     * Selects a monitor type from the dropdown.
     * @param {string} type - The type of monitor to select.
     * @returns {Promise<void>}
     */
    async selectMonitorType(type) {
        const monitorTypeSelect = this.page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();
        await monitorTypeSelect.selectOption(type);
        const selectedValue = await monitorTypeSelect.evaluate(
            (select) => select.value
        );
        expect(selectedValue).toBe(type);
    }

    /**
     * Adds a new condition to the monitor form.
     * @returns {Promise<void>}
     */
    async addCondition() {
        await this.page.getByTestId("add-condition-button").click();
    }

    /**
     * Removes the first condition from the monitor form.
     * @returns {Promise<void>}
     */
    async removeCondition() {
        await this.page.getByTestId("remove-condition").first().click();
    }

    /**
     * Adds a new condition group to the monitor form.
     * @returns {Promise<void>}
     */
    async addConditionGroup() {
        await this.page.getByTestId("add-group-button").click();
    }

    /**
     * Removes the first condition group from the monitor form.
     * @returns {Promise<void>}
     */
    async removeConditionGroup() {
        await this.page.getByTestId("remove-condition-group").first().click();
    }

    /**
     * Sets the values of conditions in the monitor form.
     * @param {string[]} values - The condition values to set.
     * @returns {Promise<void>}
     */
    async setConditionValues(values) {
        for (let i = 0; i < values.length; i++) {
            await this.page
                .getByTestId("condition-value")
                .nth(i)
                .fill(values[i]);
        }
    }

    /**
     * Verifies the number of conditions in the monitor form.
     * @param {number} expectedCount - The expected number of conditions.
     * @returns {Promise<void>}
     */
    async verifyConditionCount(expectedCount) {
        expect(await this.page.getByTestId("condition").count()).toEqual(
            expectedCount
        );
    }

    /**
     * Verifies the number of condition groups in the monitor form.
     * @param {number} expectedCount - The expected number of condition groups.
     * @returns {Promise<void>}
     */
    async verifyConditionGroupCount(expectedCount) {
        expect(await this.page.getByTestId("condition-group").count()).toEqual(
            expectedCount
        );
    }

    /**
     * Fills in the monitor details.
     * @param {string} friendlyName - The friendly name for the monitor.
     * @param {string} hostname - The hostname for the monitor.
     * @returns {Promise<void>}
     */
    async fillMonitorDetails(friendlyName, hostname) {
        await this.page.getByTestId("friendly-name-input").fill(friendlyName);
        await this.page.getByTestId("hostname-input").fill(hostname);
    }

    /**
     * Selects the resolve type from the dropdown.
     * @param {string} type - The type of resolve to select.
     * @returns {Promise<void>}
     */
    async selectResolveType(type) {
        const resolveTypeSelect = this.page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: type }).click();
    }

    /**
     * Saves the monitor configuration.
     * @returns {Promise<void>}
     */
    async saveMonitor() {
        await this.page.getByTestId("save-button").click();
    }

    /**
     * Verifies the status of the monitor.
     * @param {string} expectedStatus - The expected status of the monitor.
     * @returns {Promise<void>}
     */
    async verifyMonitorStatus(expectedStatus) {
        await this.page.waitForURL("/dashboard/*");
        await expect(this.page.getByTestId("monitor-status")).toHaveText(
            expectedStatus,
            { ignoreCase: true }
        );
    }
}
