import { test, expect } from "@playwright/test";
import { getSqliteDatabaseExists } from "../util-test";

test.describe("Password Strength Indicator", () => {
    test.skip(() => !getSqliteDatabaseExists(), "Database must exist before running this test");

    test("should show password strength indicator on setup page", async ({ page }) => {
        // Navigate to setup page (assuming fresh database)
        await page.goto("./setup");

        // Fill username
        await page.getByPlaceholder("Username").fill("testuser");

        // Initially no strength indicator should be visible
        const strengthMeter = page.locator(".password-strength");
        await expect(strengthMeter).not.toBeVisible();

        // Type a weak password
        const passwordInput = page.getByPlaceholder("Password", { exact: true });
        await passwordInput.fill("weak");
        
        // Strength meter should appear
        await expect(strengthMeter).toBeVisible();

        // Type a stronger password
        await passwordInput.fill("MyStrongPassword123!");
        
        // Strength meter should still be visible
        await expect(strengthMeter).toBeVisible();
        
        // Check that the strength meter fill has the appropriate class
        const strengthFill = page.locator(".strength-meter-fill");
        await expect(strengthFill).toBeVisible();
    });

    test("should show warning for weak password", async ({ page }) => {
        await page.goto("./setup");

        await page.getByPlaceholder("Username").fill("admin");
        
        // Fill with a password that has low zxcvbn score
        await page.getByPlaceholder("Password", { exact: true }).fill("password1234");

        // Check that warning message appears
        const warningText = page.locator("text=This password may be easy to guess");
        await expect(warningText).toBeVisible();
    });

    test("should not show warning for strong password", async ({ page }) => {
        await page.goto("./setup");

        await page.getByPlaceholder("Username").fill("admin");
        
        // Fill with a strong password
        await page.getByPlaceholder("Password", { exact: true }).fill("Xy9#mK2$pQ7!vN8&zR4@");

        // Check that warning message does not appear
        const warningText = page.locator("text=This password may be easy to guess");
        await expect(warningText).not.toBeVisible();
    });

    test("should show breach warning toast for compromised password", async ({ page }) => {
        await page.goto("./setup");

        await page.getByPlaceholder("Username").fill("admin");
        
        // Use a well-known breached password that's long enough (12+ chars)
        const breachedPassword = "password1234567890";
        await page.getByPlaceholder("Password", { exact: true }).fill(breachedPassword);
        await page.getByPlaceholder("Repeat Password").fill(breachedPassword);

        // Submit the form
        await page.getByRole("button", { name: "Create" }).click();

        // Wait for and check toast warning appears
        // Toast messages typically appear in the toast container
        const toastWarning = page.locator(".toast-warning, .toast.warning, [role='alert']").filter({ hasText: /breach|data breach/i });
        await expect(toastWarning).toBeVisible({ timeout: 10000 });
    });

    test("should update strength indicator as password changes", async ({ page }) => {
        await page.goto("./setup");

        await page.getByPlaceholder("Username").fill("testuser");
        const passwordInput = page.getByPlaceholder("Password", { exact: true });

        // Start with weak password
        await passwordInput.fill("abc123456789");
        const strengthFill = page.locator(".strength-meter-fill");
        
        // Get initial width
        const initialClass = await strengthFill.getAttribute("class");
        
        // Change to stronger password
        await passwordInput.fill("MyVeryStrongP@ssw0rd!");
        
        // Class should change (indicating different strength)
        const newClass = await strengthFill.getAttribute("class");
        expect(initialClass).not.toBe(newClass);
    });
});
