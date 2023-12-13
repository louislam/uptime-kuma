import { test } from "@playwright/test";
import { screenshot } from "./util-test";

test("test", async ({ page }, testInfo) => {
    await page.goto("./");
    await page.goto("./dashboard");

    await screenshot(testInfo, page);
});
