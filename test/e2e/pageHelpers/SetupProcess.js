import { expect, test } from "@playwright/test";
import {
    getSqliteDatabaseExists,
    login,
    screenshot,
    takeSqliteSnapshot,
} from "../util-test";

export class SetupProcess {
    constructor(page) {
        this.page = page;
    }

    async setupSqlite(testInfo) {
        await this.page.goto("./");
        await this.page.getByText("SQLite").click();
        await this.page.getByRole("button", { name: "Next" }).click();
        await screenshot(testInfo, this.page);
        await this.page.waitForURL("/setup");
        await screenshot(testInfo, this.page);
    }

    async setupAdmin(testInfo, username = "admin", password = "admin123") {
        await this.page.goto("./");
        await this.page.getByPlaceholder("Username").click();
        await this.page.getByPlaceholder("Username").fill(username);
        await this.page.getByPlaceholder("Username").press("Tab");
        await this.page
            .getByPlaceholder("Password", { exact: true })
            .fill(password);
        await this.page
            .getByPlaceholder("Password", { exact: true })
            .press("Tab");
        await this.page.getByPlaceholder("Repeat Password").fill(password);
        await this.page.getByRole("button", { name: "Create" }).click();
        await screenshot(testInfo, this.page);
    }

    async login(testInfo) {
        await this.page.goto("./dashboard");
        await login(this.page);
        await screenshot(testInfo, this.page);
    }

    async logout(testInfo) {
        await this.page.goto("./dashboard");
        await login(this.page);
        await this.page.getByText("A", { exact: true }).click();
        await this.page.getByRole("button", { name: "Log out" }).click();
        await screenshot(testInfo, this.page);
    }

    async takeSqliteSnapshot(testInfo) {
        await takeSqliteSnapshot(this.page);
        await screenshot(testInfo, this.page);
    }
}
