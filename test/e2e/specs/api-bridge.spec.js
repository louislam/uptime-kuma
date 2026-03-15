import { expect, test } from "@playwright/test";
import { restoreSqliteSnapshot } from "../util-test";

const baseURL = "http://localhost:30001";

test.describe("API Bridge", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("POST /api returns 401 without Authorization header", async ({ request }) => {
        const response = await request.post(`${baseURL}/api`, {
            headers: { "Content-Type": "application/json" },
            data: { action: "getMonitorList" },
        });
        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
        expect(body.msg).toContain("API Key");
    });

    test("POST /api returns 401 with invalid API key", async ({ request }) => {
        const response = await request.post(`${baseURL}/api`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer uk999_invalidkey",
            },
            data: { action: "getMonitorList" },
        });
        expect(response.status()).toBe(401);
        const body = await response.json();
        expect(body.ok).toBe(false);
    });
});
