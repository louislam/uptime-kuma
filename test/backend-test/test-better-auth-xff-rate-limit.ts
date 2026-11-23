import { test } from "node:test";
import assert from "node:assert";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

// GHSA-gr3j-4pc8-v9q7: rotating X-Forwarded-For must not bypass the sign-in rate limit.
// Mirrors server/better-auth.ts plus the header replacement done in better-auth-router.ts.

const AUTH_URL = "http://localhost:3001/api/auth/sign-in/email";

function makeAuth() {
    return betterAuth({
        database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
        baseURL: "http://localhost:3001",
        secret: "7f3c9a1e5b8d2f604c7e9a1b3d5f8c2e6a4b9d71",
        trustedOrigins: ["*"],
        emailAndPassword: { enabled: true, disableSignUp: true },
        rateLimit: { enabled: true, window: 60, max: 10 },
    });
}

async function badLogin(
    auth: ReturnType<typeof makeAuth>,
    xff: string | undefined,
    socketIp: string,
    trustProxy = false
) {
    const headers: Record<string, string | string[] | undefined> = {
        "content-type": "application/json",
        origin: "http://localhost:3001",
    };
    if (xff !== undefined) {
        headers["x-forwarded-for"] = xff;
    }
    // Same line as better-auth-router.ts
    if (!trustProxy) {
        headers["x-forwarded-for"] = socketIp;
    }

    const res = await auth.handler(
        new Request(AUTH_URL, {
            method: "POST",
            headers: headers as Record<string, string>,
            body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
        })
    );
    return res.status;
}

/** @returns status codes of 15 consecutive bad sign-ins */
async function fifteenAttempts(xffFor: (i: number) => string | undefined, socketIp: string, trustProxy = false) {
    const auth = makeAuth();
    const codes: number[] = [];
    for (let i = 0; i < 15; i++) {
        codes.push(await badLogin(auth, xffFor(i), socketIp, trustProxy));
    }
    console.log(`  codes: ${codes.join(" ")}`);
    return codes;
}

test("sign-in rate limit, no reverse proxy", async (t) => {
    await t.test("trips without any header", async () => {
        const codes = await fifteenAttempts(() => undefined, "203.0.113.9");
        assert.ok(codes.includes(429), `expected a 429, got ${codes.join(" ")}`);
    });

    await t.test("is not bypassed by rotating a single-value X-Forwarded-For", async () => {
        const codes = await fifteenAttempts((i) => `10.0.0.${i + 1}`, "203.0.113.10");
        assert.ok(codes.includes(429), `rate limit bypassed, no 429 in ${codes.join(" ")}`);
    });

    await t.test("is not bypassed by a multi-value X-Forwarded-For", async () => {
        const codes = await fifteenAttempts((i) => `10.0.0.${i + 1}, 192.168.1.1`, "203.0.113.11");
        assert.ok(codes.includes(429), `rate limit bypassed, no 429 in ${codes.join(" ")}`);
    });
});

test("sign-in rate limit behind a proxy (trustProxy on)", async (t) => {
    await t.test("keeps limiting when the proxy appends a chain", async () => {
        // nginx with $proxy_add_x_forwarded_for produces "<client value>, <peer>"
        const codes = await fifteenAttempts((i) => `10.0.0.${i + 1}, 198.51.100.7`, "127.0.0.1", true);
        assert.ok(codes.includes(429), `rate limit bypassed, no 429 in ${codes.join(" ")}`);
    });
});
