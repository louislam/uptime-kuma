import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Status Page", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("create and edit", async ({ page }, testInfo) => {
        test.setTimeout(60000); // Keep the timeout increase for stability

        // Monitor
        const monitorName = "Monitor for Status Page";
        const tagName = "Client";
        const tagValue = "Acme Inc";
        const tagName2 = "Project"; // Add second tag name
        const tagValue2 = "Phoenix"; // Add second tag value
        const monitorUrl = "https://www.example.com/status";
        const monitorCustomUrl = "https://www.example.com";

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
        await page.getByTestId("url-input").fill(monitorUrl);

        // Modified tag section to add multiple tags
        await page.getByTestId("add-tag-button").click();
        await page.getByTestId("tag-name-input").fill(tagName);
        await page.getByTestId("tag-value-input").fill(tagValue);
        await page.getByTestId("tag-color-select").click(); // Vue-Multiselect component
        await page.getByTestId("tag-color-select").getByRole("option", { name: "Orange" }).click();

        // Add another tag instead of submitting directly
        await page.getByRole("button", { name: "Add Another Tag" }).click();

        // Add second tag
        await page.getByTestId("tag-name-input").fill(tagName2);
        await page.getByTestId("tag-value-input").fill(tagValue2);
        await page.getByTestId("tag-color-select").click();
        await page.getByTestId("tag-color-select").getByRole("option", { name: "Blue" }).click();

        // Submit both tags
        await page.getByTestId("add-tags-final-button").click();

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
        await expect(page.getByTestId("monitor-name")).not.toHaveAttribute("href");

        // Set public url on
        await page.getByTestId("monitor-settings").click();
        await page.getByTestId("show-clickable-link").check();
        await page.getByTestId("custom-url-input").fill(monitorCustomUrl);
        await page.getByTestId("monitor-settings-close").click();

        // Save the changes
        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);

        // Ensure changes are visible
        await expect(page.getByTestId("incident")).toHaveCount(1);
        await expect(page.getByTestId("incident-title")).toContainText(incidentTitle);
        await expect(page.getByTestId("incident-content")).toContainText(incidentContent);
        await expect(page.getByTestId("group-name")).toContainText(groupName);
        await expect(page.getByTestId("powered-by")).toHaveCount(0);

        await expect(page.getByTestId("monitor-name")).toHaveAttribute("href", monitorCustomUrl);

        await expect(page.getByTestId("update-countdown-text")).toContainText("00:");
        const updateCountdown = Number((await page.getByTestId("update-countdown-text").textContent()).match(/(\d+):(\d+)/)[2]);
        expect(updateCountdown).toBeGreaterThanOrEqual(refreshInterval - 10); // cant be certain when the timer will start, so ensure it's within expected range
        expect(updateCountdown).toBeLessThanOrEqual(refreshInterval);

        await expect(page.locator("body")).toHaveClass(theme);

        // Add Google Analytics ID to head and verify
        await page.waitForFunction(() => {
            return document.head.innerHTML.includes("https://www.googletagmanager.com/gtag/js?id=");
        }, { timeout: 5000 });
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

        // Modified tag verification to check both tags
        await expect(page.getByTestId("monitor-tag").filter({ hasText: tagValue })).toBeVisible();
        await expect(page.getByTestId("monitor-tag").filter({ hasText: tagValue2 })).toBeVisible();

        await screenshot(testInfo, page);
    });

    // @todo Test certificate expiry
    // @todo Test domain names

});
