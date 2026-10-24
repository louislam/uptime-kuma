import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Monitor Group", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("lists a group with its child monitor and collapses the child", async ({ page }, testInfo) => {
        const groupName = "Example Group";
        const childName = "Grouped Monitor";

        await page.goto("./add");
        await login(page);

        // Create the group
        await page.getByTestId("monitor-type-select").selectOption("group");
        await page.getByTestId("friendly-name-input").fill(groupName);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        // Create a monitor inside the group
        await page.goto("./add");
        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill(childName);
        await page.getByTestId("url-input").fill("https://example.com");
        await page.locator("#monitorGroupSelector").selectOption({ label: groupName });
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        // Saving navigates to the new monitor's details page; go back to the list
        await page.goto("./dashboard");
        await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');

        const monitorList = page.getByTestId("monitor-list");
        await expect(monitorList).toContainText(groupName);

        // Groups are collapsed by default: the child row is hidden
        await expect(monitorList).not.toContainText(childName);

        // Expanding the group shows the child row
        await page.getByTestId("monitor-collapse").first().click();
        await expect(monitorList).toContainText(childName);
        await screenshot(testInfo, page);

        // Collapsing again hides it
        await page.getByTestId("monitor-collapse").first().click();
        await expect(monitorList).not.toContainText(childName);
    });
    test("moves a monitor to another group by drag and drop", async ({ page }) => {
        const groupA = "Group A";
        const groupB = "Group B";
        const childName = "Draggable Monitor";

        await page.goto("./add");
        await login(page);

        // Group A with one monitor
        await page.getByTestId("monitor-type-select").selectOption("group");
        await page.getByTestId("friendly-name-input").fill(groupA);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.goto("./add");
        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill(childName);
        await page.getByTestId("url-input").fill("https://example.com");
        await page.locator("#monitorGroupSelector").selectOption({ label: groupA });
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        // Group B
        await page.goto("./add");
        await page.getByTestId("monitor-type-select").selectOption("group");
        await page.getByTestId("friendly-name-input").fill(groupB);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.goto("./dashboard");
        await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');

        // Expand group A so the child row is visible, then drag it onto group B
        await page
            .locator(".draggable-item", { hasText: groupA })
            .locator('[data-testid="monitor-collapse"]')
            .first()
            .click();
        const childHref = await page.locator("a.item", { hasText: childName }).first().getAttribute("href");
        await page
            .locator("a.item", { hasText: childName })
            .first()
            .dragTo(page.locator("a.item", { hasText: groupB }).first());

        // The monitor now belongs to group B
        const childId = childHref.split("/").pop();
        await page.goto("./edit/" + childId);
        await expect(page.locator("#monitorGroupSelector option:checked")).toHaveText(groupB);
    });
});
