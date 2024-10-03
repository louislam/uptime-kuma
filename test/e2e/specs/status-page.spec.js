import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Status Page", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("create and edit", async ({ page }, testInfo) => {
        // Monitor
        const monitorName = "Monitor for Status Page";
        const tagName = "Client";
        const tagValue = "Acme Inc";

        // Status Page
        const footerText = "This is footer text.";
        const refreshInterval = 30;
        const theme = "dark";
        const googleAnalyticsId = "G-123";
        const customCss = "body { background: rgb(0, 128, 128) !important; }";
        const descriptionText = "This is an example status page.";
        const incidentTitle = "Example Outage Incident";
        const incidentContent = "Sample incident message.";
        const groupName = "Example Group 1";

        // Set up a monitor that can be added to the Status Page
        await page.goto("./add");
        await login(page);
        await expect(page.getByTestId("monitor-type-select")).toBeVisible();
        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill(monitorName);
        await page.getByTestId("url-input").fill("https://www.example.com/");
        await page.getByTestId("add-tag-button").click();
        await page.getByTestId("tag-name-input").fill(tagName);
        await page.getByTestId("tag-value-input").fill(tagValue);
        await page.getByTestId("tag-color-select").click(); // Vue-Multiselect component
        await page.getByTestId("tag-color-select").getByRole("option", { name: "Orange" }).click();
        await page.getByTestId("tag-submit-button").click();
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created

        // Create a new status page
        await page.goto("./add-status-page");
        await screenshot(testInfo, page);

        await page.getByTestId("name-input").fill("Example");
        await page.getByTestId("slug-input").fill("example");
        await page.getByTestId("submit-button").click();
        await page.waitForURL("/status/example?edit"); // wait for the page to be created

        // Fill in some details
        await page.getByTestId("description-input").fill(descriptionText);
        await page.getByTestId("footer-text-input").fill(footerText);
        await page.getByTestId("refresh-interval-input").fill(String(refreshInterval));
        await page.getByTestId("theme-select").selectOption(theme);
        await page.getByTestId("show-tags-checkbox").uncheck();
        await page.getByTestId("show-powered-by-checkbox").uncheck();
        await page.getByTestId("show-certificate-expiry-checkbox").uncheck();
        await page.getByTestId("google-analytics-input").fill(googleAnalyticsId);
        await page.getByTestId("custom-css-input").getByTestId("textarea").fill(customCss); // Prism
        await expect(page.getByTestId("description-editable")).toHaveText(descriptionText);
        await expect(page.getByTestId("custom-footer-editable")).toHaveText(footerText);

        // Add an incident
        await page.getByTestId("create-incident-button").click();
        await page.getByTestId("incident-title").isEditable();
        await page.getByTestId("incident-title").fill(incidentTitle);
        await page.getByTestId("incident-content-editable").fill(incidentContent);
        await page.getByTestId("post-incident-button").click();

        // Add a group
        await page.getByTestId("add-group-button").click();
        await page.getByTestId("group-name").isEditable();
        await page.getByTestId("group-name").fill(groupName);

        // Add the monitor
        await page.getByTestId("monitor-select").click(); // Vue-Multiselect component
        await page.getByTestId("monitor-select").getByRole("option", { name: monitorName }).click();
        await expect(page.getByTestId("monitor")).toHaveCount(1);
        await expect(page.getByTestId("monitor-name")).toContainText(monitorName);

        // Save the changes
        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);

        // Ensure changes are visible
        await expect(page.getByTestId("incident")).toHaveCount(1);
        await expect(page.getByTestId("incident-title")).toContainText(incidentTitle);
        await expect(page.getByTestId("incident-content")).toContainText(incidentContent);
        await expect(page.getByTestId("description")).toContainText(descriptionText);
        await expect(page.getByTestId("group-name")).toContainText(groupName);
        await expect(page.getByTestId("footer-text")).toContainText(footerText);
        await expect(page.getByTestId("powered-by")).toHaveCount(0);

        await expect(page.getByTestId("update-countdown-text")).toContainText("00:");
        const updateCountdown = Number((await page.getByTestId("update-countdown-text").textContent()).match(/(\d+):(\d+)/)[2]);
        expect(updateCountdown).toBeGreaterThanOrEqual(refreshInterval); // cant be certain when the timer will start, so ensure it's within expected range
        expect(updateCountdown).toBeLessThanOrEqual(refreshInterval + 10);

        await expect(page.locator("body")).toHaveClass(theme);
        expect(await page.locator("head").innerHTML()).toContain(googleAnalyticsId);

        const backgroundColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
        expect(backgroundColor).toEqual("rgb(0, 128, 128)");

        await screenshot(testInfo, page);

        // Flip the "Show Tags" and "Show Powered By" switches:
        await page.getByTestId("edit-button").click();
        await expect(page.getByTestId("edit-sidebar")).toHaveCount(1);
        await page.getByTestId("show-tags-checkbox").setChecked(true);
        await page.getByTestId("show-powered-by-checkbox").setChecked(true);

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();

        await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);
        await expect(page.getByTestId("powered-by")).toContainText("Powered by");
        await expect(page.getByTestId("monitor-tag")).toContainText(tagValue);

        await screenshot(testInfo, page);
    });

    // @todo Test certificate expiry
    // @todo Test domain names

});
