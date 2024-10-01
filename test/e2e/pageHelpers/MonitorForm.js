import { screenshot, login, restoreSqliteSnapshot } from "../util-test";
import { expect } from "@playwright/test";

export class MonitorForm {
    constructor(page) {
        this.page = page;
    }

    async navigateToAddPage() {
        await this.page.goto("./add");
    }

    async login(testInfo) {
        await login(this.page);
        await screenshot(testInfo, this.page);
    }

    async selectMonitorType(type) {
        const monitorTypeSelect = this.page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();
        await monitorTypeSelect.selectOption(type);
        const selectedValue = await monitorTypeSelect.evaluate(
            (select) => select.value
        );
        expect(selectedValue).toBe(type);
    }

    async addCondition() {
        await this.page.getByTestId("add-condition-button").click();
    }

    async removeCondition() {
        await this.page.getByTestId("remove-condition").first().click();
    }

    async addConditionGroup() {
        await this.page.getByTestId("add-group-button").click();
    }

    async removeConditionGroup() {
        await this.page.getByTestId("remove-condition-group").first().click();
    }

    async setConditionValues(values) {
        for (let i = 0; i < values.length; i++) {
            await this.page
                .getByTestId("condition-value")
                .nth(i)
                .fill(values[i]);
        }
    }

    async verifyConditionCount(expectedCount) {
        expect(await this.page.getByTestId("condition").count()).toEqual(
            expectedCount
        );
    }

    async verifyConditionGroupCount(expectedCount) {
        expect(await this.page.getByTestId("condition-group").count()).toEqual(
            expectedCount
        );
    }

    async fillMonitorDetails(friendlyName, hostname) {
        await this.page.getByTestId("friendly-name-input").fill(friendlyName);
        await this.page.getByTestId("hostname-input").fill(hostname);
    }

    async selectResolveType(type) {
        const resolveTypeSelect = this.page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: type }).click();
    }

    async saveMonitor() {
        await this.page.getByTestId("save-button").click();
    }

    async verifyMonitorStatus(expectedStatus) {
        await this.page.waitForURL("/dashboard/*");
        await expect(this.page.getByTestId("monitor-status")).toHaveText(
            expectedStatus,
            { ignoreCase: true }
        );
    }
}
