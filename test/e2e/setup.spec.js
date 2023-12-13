import { test, expect } from "@playwright/test";
import { screenshot } from "./util-test";

test("test", async ({ page }, testInfo) => {
    await page.goto("http://localhost:3001/");
    await page.goto("http://localhost:3001/dashboard");

    await screenshot(testInfo, page);
});
