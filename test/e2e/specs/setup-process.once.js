import { test } from "@playwright/test";
import { getSqliteDatabaseExists } from "../util-test";
import { SetupProcess } from "./SetupProcess";

test.describe("Uptime Kuma Setup", () => {
    test.skip(
        () => getSqliteDatabaseExists(),
        "Must only run once per session"
    );

    let setup;

    test.beforeEach(async ({ page }) => {
        setup = new SetupProcess(page);
    });

    /*
     * Setup
     */
    test("setup sqlite", async ({ page }, testInfo) => {
        await setup.setupSqlite(testInfo);
    });

    test("setup admin", async ({ page }, testInfo) => {
        await setup.setupAdmin(testInfo);
    });

    /*
     * All other tests should be run after setup
     */
    test("login", async ({ page }, testInfo) => {
        await setup.login(testInfo);
    });

    test("logout", async ({ page }, testInfo) => {
        await setup.logout(testInfo);
    });

    test("take sqlite snapshot", async ({ page }, testInfo) => {
        await setup.takeSqliteSnapshot(testInfo);
    });
});
