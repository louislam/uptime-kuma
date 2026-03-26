import { test, expect } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * Login and navigate to user management settings
 * @param {Page} page Playwright page
 * @returns {Promise<void>}
 */
async function loginAndGoToUsers(page) {
    await page.goto("./dashboard");
    await login(page);
    await expect(page.getByText("Add New Monitor")).toBeVisible();
    await page.goto("./settings/users");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Add User" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".item", { hasText: "admin" })).toBeVisible();
}

/**
 * Create a user via the UI
 * @param {Page} page Playwright page
 * @param {string} username Username
 * @param {string} password Password
 * @returns {Promise<void>}
 */
async function createUser(page, username, password) {
    await page.getByRole("button", { name: "Add User" }).click();
    await page.locator("#user-username").fill(username);
    await page.locator("#user-password").fill(password);
    await page.locator("#user-password-repeat").fill(password);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".item", { hasText: username })).toBeVisible();
}

test.describe("User Management", () => {

    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("add a new user", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);
        await createUser(page, "testuser", "testpass123");
        await screenshot(testInfo, page);
    });

    test("reject duplicate username", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);
        await createUser(page, "dupuser", "testpass123");

        // Try to create duplicate — modal should stay open
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("dupuser");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();

        // Modal stays open on error — the modal should still be visible
        await expect(page.locator(".modal.show")).toBeVisible();
        // Only one "dupuser" item should exist
        await expect(page.locator(".item", { hasText: "dupuser" })).toHaveCount(1);
        await screenshot(testInfo, page);
    });

    test("edit a user's username", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);
        await createUser(page, "editme", "testpass123");

        // Edit username
        await page.locator(".item", { hasText: "editme" }).getByRole("button", { name: "Edit" }).click();
        await page.locator("#user-username").fill("renamed");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page.locator(".item", { hasText: "renamed" })).toBeVisible();
        await expect(page.locator(".item", { hasText: "editme" })).toHaveCount(0);
        await screenshot(testInfo, page);
    });

    test("change a user's password and login with new credentials", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);
        await createUser(page, "pwduser", "oldpass123");

        // Change password
        await page.locator(".item", { hasText: "pwduser" }).getByRole("button", { name: "Change Password" }).click();
        await page.locator("#change-password").fill("newpass456");
        await page.locator("#change-password-repeat").fill("newpass456");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".modal.show")).toHaveCount(0, { timeout: 10000 });

        // Logout
        await page.goto("./dashboard");
        await page.getByText("A", { exact: true }).click();
        await page.getByRole("button", { name: "Log out" }).click();

        // Login as pwduser with new password
        await page.getByPlaceholder("Username").fill("pwduser");
        await page.getByPlaceholder("Password").fill("newpass456");
        await page.getByRole("button", { name: "Log in" }).click();
        await expect(page.getByText("Add New Monitor")).toBeVisible();
        await screenshot(testInfo, page);
    });

    test("delete a user", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);
        await createUser(page, "deleteme", "testpass123");

        // Delete user
        await page.locator(".item", { hasText: "deleteme" }).getByRole("button", { name: "Delete" }).click();
        await page.getByRole("button", { name: "Yes" }).click();

        await expect(page.locator(".item", { hasText: "deleteme" })).toHaveCount(0);

        // Verify deletion persists after reload
        await page.reload();
        await page.waitForLoadState("networkidle");
        await expect(page.getByRole("button", { name: "Add User" })).toBeVisible({ timeout: 15000 });
        await expect(page.locator(".item", { hasText: "deleteme" })).toHaveCount(0);
        await screenshot(testInfo, page);
    });

    test("cannot delete own account", async ({ page }, testInfo) => {
        await loginAndGoToUsers(page);

        // The admin user's delete button should be disabled
        const adminItem = page.locator(".item").filter({ hasText: "admin" });
        const deleteBtn = adminItem.getByRole("button", { name: "Delete" });
        await expect(deleteBtn).toBeVisible();
        await expect(deleteBtn).toBeDisabled();
        await screenshot(testInfo, page);
    });
});
