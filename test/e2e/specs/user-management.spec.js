import { test, expect } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("User Management", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot();
    });

    test("navigate to user management tab", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");
        await expect(page.getByRole("button", { name: "Add User" })).toBeVisible();
        await screenshot(testInfo, page);
    });

    test("add a new user", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("testuser");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page.locator(".item", { hasText: "testuser" })).toBeVisible();
        await screenshot(testInfo, page);
    });

    test("reject duplicate username", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        // Create first user
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("dupuser");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".item", { hasText: "dupuser" })).toBeVisible();

        // Try to create duplicate
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("dupuser");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();

        // Toast error should appear
        await expect(page.locator(".toast-body", { hasText: "Username already exists" })).toBeVisible();
        await screenshot(testInfo, page);
    });

    test("reject mismatched passwords", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("mismatch");
        await page.locator("#user-password").fill("pass1");
        await page.locator("#user-password-repeat").fill("pass2");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page.locator(".toast-body", { hasText: "repeat password" })).toBeVisible();
        await screenshot(testInfo, page);
    });

    test("edit a user's username", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        // Create user
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("editme");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".item", { hasText: "editme" })).toBeVisible();

        // Edit username
        await page.locator(".item", { hasText: "editme" }).getByRole("button", { name: "Edit" }).click();
        await page.locator("#user-username").fill("renamed");
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page.locator(".item", { hasText: "renamed" })).toBeVisible();
        await expect(page.locator(".item", { hasText: "editme" })).toHaveCount(0);
        await screenshot(testInfo, page);
    });

    test("change a user's password and login with new password", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        // Create user
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("pwduser");
        await page.locator("#user-password").fill("oldpass123");
        await page.locator("#user-password-repeat").fill("oldpass123");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".item", { hasText: "pwduser" })).toBeVisible();

        // Change password
        await page.locator(".item", { hasText: "pwduser" }).getByRole("button", { name: "Change Password" }).click();
        await page.locator("#change-password").fill("newpass456");
        await page.locator("#change-password-repeat").fill("newpass456");
        await page.getByRole("button", { name: "Save" }).click();

        // Logout and login as new user with new password
        await page.goto("./settings/security");
        await page.getByRole("button", { name: "Logout" }).click();
        await page.getByPlaceholder("Username").fill("pwduser");
        await page.getByPlaceholder("Password").fill("newpass456");
        await page.getByRole("button", { name: "Log in" }).click();
        await page.isVisible("text=Add New Monitor");
        await screenshot(testInfo, page);
    });

    test("delete a user", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        // Create user to delete
        await page.getByRole("button", { name: "Add User" }).click();
        await page.locator("#user-username").fill("deleteme");
        await page.locator("#user-password").fill("testpass123");
        await page.locator("#user-password-repeat").fill("testpass123");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.locator(".item", { hasText: "deleteme" })).toBeVisible();

        // Delete user
        await page.locator(".item", { hasText: "deleteme" }).getByRole("button", { name: "Delete" }).click();
        await page.getByRole("button", { name: "Yes" }).click();

        await expect(page.locator(".item", { hasText: "deleteme" })).toHaveCount(0);
        await screenshot(testInfo, page);
    });

    test("cannot delete own account", async ({ page }, testInfo) => {
        await page.goto("./settings/users");
        await login(page);
        await page.goto("./settings/users");

        // The admin user's delete button should be disabled
        const adminItem = page.locator(".item", { hasText: "admin" });
        await expect(adminItem.getByRole("button", { name: "Delete" })).toBeDisabled();
        await screenshot(testInfo, page);
    });
});
