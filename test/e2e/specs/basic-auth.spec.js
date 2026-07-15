import { test, expect } from "@playwright/test";
import { restoreSqliteSnapshot } from "../util-test";

const serverUrl = require("../../../config/playwright.config.js").url;

test.describe("/metrics basic auth", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("returns 401 without credentials", async ({ request }) => {
        const response = await request.get(`${serverUrl}/metrics`);
        expect(response.status()).toBe(401);
    });

    test("returns 401 with wrong password", async ({ request }) => {
        const response = await request.get(`${serverUrl}/metrics`, {
            headers: {
                Authorization: "Basic " + btoa("admin:wrongpassword"),
            },
        });
        expect(response.status()).toBe(401);
    });

    test("returns 200 with correct credentials", async ({ request }) => {
        const response = await request.get(`${serverUrl}/metrics`, {
            headers: {
                Authorization: "Basic " + btoa("admin:admin123"),
            },
        });
        expect(response.status()).toBe(200);
    });

    test("response contains prometheus metrics", async ({ request }) => {
        const response = await request.get(`${serverUrl}/metrics`, {
            headers: {
                Authorization: "Basic " + btoa("admin:admin123"),
            },
        });
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body).toContain("# HELP");
        expect(body).toContain("# TYPE");
    });
});
