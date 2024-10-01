import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

export class StatusPage {
    constructor(page) {
        this.page = page;
    }

    async goToMonitorAddPage() {
        await this.page.goto("./add");
    }

    async goToStatusPageAdd() {
        await this.page.goto("./add-status-page");
    }

    async fillMonitorDetails(monitorName, tagName, tagValue) {
        await this.page.getByTestId("monitor-type-select").selectOption("http");
        await this.page.getByTestId("friendly-name-input").fill(monitorName);
        await this.page
            .getByTestId("url-input")
            .fill("https://www.example.com/");
        await this.page.getByTestId("add-tag-button").click();
        await this.page.getByTestId("tag-name-input").fill(tagName);
        await this.page.getByTestId("tag-value-input").fill(tagValue);
        await this.page.getByTestId("tag-color-select").click();
        await this.page
            .getByTestId("tag-color-select")
            .getByRole("option", { name: "Orange" })
            .click();
        await this.page.getByTestId("tag-submit-button").click();
        await this.page.getByTestId("save-button").click();
    }

    async fillStatusPageDetails(
        descriptionText,
        footerText,
        refreshInterval,
        theme,
        googleAnalyticsId,
        customCss
    ) {
        await this.page.getByTestId("description-input").fill(descriptionText);
        await this.page.getByTestId("footer-text-input").fill(footerText);
        await this.page
            .getByTestId("refresh-interval-input")
            .fill(String(refreshInterval));
        await this.page.getByTestId("theme-select").selectOption(theme);
        await this.page.getByTestId("show-tags-checkbox").uncheck();
        await this.page.getByTestId("show-powered-by-checkbox").uncheck();
        await this.page
            .getByTestId("show-certificate-expiry-checkbox")
            .uncheck();
        await this.page
            .getByTestId("google-analytics-input")
            .fill(googleAnalyticsId);
        await this.page
            .getByTestId("custom-css-input")
            .getByTestId("textarea")
            .fill(customCss);
    }

    async addIncident(incidentTitle, incidentContent) {
        await this.page.getByTestId("create-incident-button").click();
        await this.page.getByTestId("incident-title").fill(incidentTitle);
        await this.page
            .getByTestId("incident-content-editable")
            .fill(incidentContent);
        await this.page.getByTestId("post-incident-button").click();
    }

    async addGroup(groupName) {
        await this.page.getByTestId("add-group-button").click();
        await this.page.getByTestId("group-name").fill(groupName);
    }

    async addMonitorToGroup(monitorName) {
        await this.page.getByTestId("monitor-select").click();
        await this.page
            .getByTestId("monitor-select")
            .getByRole("option", { name: monitorName })
            .click();
    }

    async saveChanges() {
        await this.page.getByTestId("save-button").click();
    }

    async verifyChanges(
        descriptionText,
        footerText,
        incidentTitle,
        incidentContent,
        groupName,
        tagValue,
        theme,
        googleAnalyticsId,
        refreshInterval
    ) {
        await expect(this.page.getByTestId("description")).toContainText(
            descriptionText
        );
        await expect(this.page.getByTestId("footer-text")).toContainText(
            footerText
        );
        await expect(this.page.getByTestId("incident-title")).toContainText(
            incidentTitle
        );
        await expect(this.page.getByTestId("incident-content")).toContainText(
            incidentContent
        );
        await expect(this.page.getByTestId("group-name")).toContainText(
            groupName
        );
        await expect(this.page.getByTestId("monitor-tag")).toContainText(
            tagValue
        );

        const backgroundColor = await this.page.evaluate(
            () => window.getComputedStyle(document.body).backgroundColor
        );
        expect(backgroundColor).toEqual("rgb(0, 128, 128)");

        const updateCountdown = Number(
            (
                await this.page
                    .getByTestId("update-countdown-text")
                    .textContent()
            ).match(/(\d+):(\d+)/)[2]
        );
        expect(updateCountdown).toBeGreaterThanOrEqual(refreshInterval);
        expect(updateCountdown).toBeLessThanOrEqual(refreshInterval + 10);

        await expect(this.page.locator("body")).toHaveClass(theme);
        expect(await this.page.locator("head").innerHTML()).toContain(
            googleAnalyticsId
        );
    }

    async toggleShowTagsPoweredBy() {
        await this.page.getByTestId("edit-button").click();
        await this.page.getByTestId("show-tags-checkbox").setChecked(true);
        await this.page
            .getByTestId("show-powered-by-checkbox")
            .setChecked(true);
    }
}
