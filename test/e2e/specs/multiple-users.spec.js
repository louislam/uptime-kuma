import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Multiple Users", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("test multiple users", async ({ page }, testInfo) => {
        // Login as admin
        await page.goto("./settings/users");
        await login(page, "admin");

        // Check if the user list contains only the admin user
        await expect(page.getByTestId("users-list")).toHaveCount(1);

        await screenshot(testInfo, page);

        // Add a second user
        await page.goto("./settings/users/add");

        await expect(page.getByTestId("username-input")).toBeVisible();
        await page.getByTestId("username-input").fill("newuser");
        await page.getByTestId("password-input").fill("newuser123");
        await page.getByTestId("password-repeat-input").fill("newuser123");
        await page.getByTestId("submit-create-admin-form").click();

        // Ensure the new user is created and visible in the user list
        await page.waitForURL("./settings/users");
        await expect(page.getByTestId("users-list")).toContainText("newuser");
        await expect(page.getByTestId("users-list").locator("[data-testid='user-item']")).toHaveCount(2);

        await screenshot(testInfo, page);

        // Disable the admin user
        await page.getByTestId("toggle-active-user-admin").click();
        await page.getByRole("button", {
            name: "Yes",
            exact: true
        }).click();
        await expect(page.getByTestId("lost-connection")).toBeVisible();

        // Make sure we're back on the login page after refresh
        await page.reload();
        await expect(page.getByText("Log in")).toBeVisible();

        // Try to log in as the admin user
        await login(page, "admin", true); // Expect failure
        await screenshot(testInfo, page);

        // Login as the new user
        await page.goto("./dashboard"); // Assuming the new user has ID 2
        await login(page, "newuser");
        await screenshot(testInfo, page);

        // Disable self-user
        await page.goto("./settings/users/edit/2");
        await page.getByTestId("active-checkbox").uncheck();
        await expect(page.getByTestId("lost-connection")).toBeVisible();

        await screenshot(testInfo, page);

        // Make sure we're back on the login page after refresh
        await page.reload();
        await expect(page.getByText("Log in")).toBeVisible();

        // Try to log in as the new user
        await login(page, "newuser", true); // Expect failure
        await screenshot(testInfo, page);
    });
});
