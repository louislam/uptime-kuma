import { test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";
import { StatusPage } from "../pageHelpers/StatusPage";

test.describe("Status Page", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("create and edit", async ({ page }, testInfo) => {
        const statusPage = new StatusPage(page);

        await statusPage.goToMonitorAddPage();
        await login(page);
        await statusPage.fillMonitorDetails(
            "Monitor for Status Page",
            "Client",
            "Acme Inc"
        );
        await page.waitForURL("/dashboard/*");

        await statusPage.goToStatusPageAdd();
        await screenshot(testInfo, page);

        await page.getByTestId("name-input").fill("Example");
        await page.getByTestId("slug-input").fill("example");
        await statusPage.saveChanges();
        await page.waitForURL("/status/example?edit");

        await statusPage.fillStatusPageDetails(
            "This is an example status page.",
            "This is footer text.",
            30,
            "dark",
            "G-123",
            "body { background: rgb(0, 128, 128) !important; }"
        );
        await statusPage.addIncident(
            "Example Outage Incident",
            "Sample incident message."
        );
        await statusPage.addGroup("Example Group 1");
        await statusPage.addMonitorToGroup("Monitor for Status Page");
        await statusPage.saveChanges();
        await screenshot(testInfo, page);

        await statusPage.verifyChanges(
            "This is an example status page.",
            "This is footer text.",
            "Example Outage Incident",
            "Sample incident message.",
            "Example Group 1",
            "Acme Inc",
            "dark",
            "G-123",
            30
        );
        await screenshot(testInfo, page);

        await statusPage.toggleShowTagsPoweredBy();
        await statusPage.saveChanges();
        await screenshot(testInfo, page);
    });

    // @todo Test certificate expiry
    // @todo Test domain names
});
