import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";

const password = "Kuma-E2E-8f4Q2xR9p";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * The current TOTP code of the otpauth URI better-auth returned
 * @param {string} uri The otpauth URI
 * @returns {Promise<string>} The 6-digit code
 */
async function currentTOTP(uri) {
    const secret = new URL(uri).searchParams.get("secret");
    return await createOTP(new TextDecoder().decode(base32.decode(secret))).totp();
}

/**
 * Open the security settings, signing in first when the session is gone
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function openSecuritySettings(page) {
    await page.goto("./settings/security");

    // The login form only renders once the socket reports loginRequired
    await Promise.race([
        page.getByRole("button", { name: "2FA Settings" }).waitFor(),
        page.getByPlaceholder("Username").waitFor(),
    ]);

    if (await page.getByPlaceholder("Username").isVisible()) {
        await page.getByPlaceholder("Username").fill("admin");
        await page.getByPlaceholder("Password").fill(password);
        await page.getByRole("button", { name: "Log in" }).click();
    }

    await expect(page.getByRole("button", { name: "2FA Settings" })).toBeVisible();
}

test("a wrong password is shown in the 2FA dialog", async ({ page }) => {
    await openSecuritySettings(page);

    await page.getByRole("button", { name: "2FA Settings" }).click();
    const dialog = page.locator(".modal.show");
    await dialog.locator("#current-password").fill("not-the-password");
    await dialog.getByRole("button", { name: "Enable 2FA" }).click();

    await expect(page.getByText("Invalid password")).toBeVisible();
    await expect(dialog.locator('input[autocomplete="one-time-code"]')).toBeHidden();
});

test("2FA can be enabled, used to sign in, and disabled", async ({ page }) => {
    await openSecuritySettings(page);

    // Enable 2FA and read the secret from the URI the dialog offers for manual entry
    await page.getByRole("button", { name: "2FA Settings" }).click();
    let dialog = page.locator(".modal.show");
    await dialog.locator("#current-password").fill(password);
    await dialog.getByRole("button", { name: "Enable 2FA" }).click();
    await dialog.getByRole("button", { name: "Show URI" }).click();
    const uri = (await dialog.locator("p.text-break").textContent()).trim();
    expect(uri.startsWith("otpauth://totp/")).toBe(true);

    await dialog.locator('input[autocomplete="one-time-code"]').fill(await currentTOTP(uri));
    await dialog.getByRole("button", { name: "Save" }).click();
    await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("2FA Enabled.")).toBeVisible();

    // The dialog reports 2FA as active afterwards
    await page.getByRole("button", { name: "2FA Settings" }).click();
    dialog = page.locator(".modal.show");
    await expect(dialog.getByText("Active", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();

    // Log out, then the password alone is not enough anymore
    await page.goto("./dashboard");
    await page.getByText("A", { exact: true }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#otp")).toBeVisible();

    await page.locator("#otp").fill(await currentTOTP(uri));
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Add New Monitor")).toBeVisible();

    // Disable 2FA again
    await page.goto("./settings/security");
    await page.getByRole("button", { name: "2FA Settings" }).click();
    dialog = page.locator(".modal.show");
    await dialog.locator("#current-password").fill(password);
    await dialog.getByRole("button", { name: "Disable 2FA" }).click();
    await page.locator(".modal.show").getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("2FA Disabled.")).toBeVisible();

    // The password alone signs in again
    await page.goto("./dashboard");
    await page.getByText("A", { exact: true }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await login(page);
    await expect(page.locator("#otp")).toBeHidden();
    await expect(page.getByText("Add New Monitor")).toBeVisible();
});
