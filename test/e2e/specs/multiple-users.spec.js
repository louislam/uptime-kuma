import { expect, test } from "@playwright/test";
import { login, screenshot } from "../util-test";

/**
 * Add a new user and return the password of the new user
 * @param {import("@playwright/test").TestInfo} testInfo 
 * @param {import("@playwright/test").Page} page 
 * @param {string} username 
 * @param {number} currentCount 
 * @returns {Promise<string>}
 */
const addUser = async (testInfo, page, username, currentCount) => {
    // Count expected after adding the user
    const expectedCount = currentCount + 1;

    // Go to the users settings
    await page.goto("./settings/users");

    // Check if the user list contains only the admin user
    await expect(page.getByTestId("user")).toHaveCount(currentCount);
    await screenshot(testInfo, page);

    // Add the user
    await page.getByTestId("add-user-button").click();

    await expect(page.getByTestId("username-input")).toBeVisible();
    await page.getByTestId("username-input").fill(username);
    await page.getByRole("button", {
        name: "Confirm",
        exact: true
    }).click();

    // Ensure the new user is created and visible in the user list
    await expect(page.getByTestId("users-list")).toContainText(username);
    await expect(page.getByTestId("user")).toHaveCount(expectedCount);

    // Get the password of the new user
    await expect(page.getByTestId("password-input")).toBeVisible();
    const password = await page.getByTestId("password-input").locator("input").inputValue();
    await page.getByTestId("password-close-button").click();

    // Do a screenshot of the new list
    await screenshot(testInfo, page);

    return password;
}

/**
 * Login as a user and check if the login is successful or not
 * @param {import("@playwright/test").TestInfo} testInfo 
 * @param {import("@playwright/test").Page} page 
 * @param {string} username 
 * @param {string} password 
 * @param {boolean} expectedToFail 
 * @returns 
 */
const loginAsUser = async (testInfo, page, username, password, expectedToFail = false) => {
    // Go to the login page
    await page.goto("./settings/security");

    // Log in as the new user
    await login(page, username, password);

    if (expectedToFail) {
        // Ensure the user is not logged in and still on the login page
        await expect(page.getByText("Incorrect username or password")).toBeVisible();
        await expect(page.getByText("Log in")).toBeVisible();
        return;
    }

    // Ensure the user is logged in and on the dashboard page
    await expect(page.getByText("Log out " + username)).toBeVisible();

    await screenshot(testInfo, page);

    // Log out
    await page.getByTestId("logout-button").click();
    await expect(page.getByText("Log in")).toBeVisible();
}

/**
 * Logout as admin
 * @param {import("@playwright/test").Page} page 
 */
const logoutAdmin = async (page) => {
    // Logout as admin
    await page.getByText("A", { exact: true }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByText("Log in")).toBeVisible();
}

test.describe("Multiple Users", () => {
    test("test multiple users", async ({ page }, testInfo) => {
        // Login as admin
        await page.goto("./dashboard");
        await login(page);
        await expect(page.getByText("Add New Monitor")).toBeVisible();

        // Perform the user add tests
        const user1Password = await addUser(testInfo, page, "newuser1", 1);
        const user2Password = await addUser(testInfo, page, "newuser2", 2);

        // Logout as admin
        await logoutAdmin(page);

        // Check the connection for the new users
        await loginAsUser(testInfo, page, "newuser1", user1Password);
        await loginAsUser(testInfo, page, "newuser2", user2Password);

        // Back as admin, remove one of the new user and check that they cannot log in
        await page.goto("./settings/users");
        await login(page);

        await expect(page.getByTestId("user")).toHaveCount(3);

        await page.getByTestId("delete-user-button").first().click();
        await page.getByRole("button", {
            name: "Yes",
            exact: true
        }).click();

        await expect(page.getByTestId("user")).toHaveCount(2);
        await screenshot(testInfo, page);

        // Try to log in as the new users
        await logoutAdmin(page);
        await loginAsUser(testInfo, page, "newuser1", user1Password, true); // Expect failure
        await loginAsUser(testInfo, page, "newuser2", user2Password); // Expect success
    });
});