import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { auth } from "../../server/better-auth";
import { shouldSecureCookies } from "../../server/util";

// @ts-ignore
import TestDB from "../mock-testdb";

const username = "cookieadmin";
const password = "Kuma-Test-8f4Q2xR9p";

/**
 * Build a minimal Express request for shouldSecureCookies()
 * @param {object} headers Request headers
 * @param {boolean} secure Whether the socket is TLS
 * @returns {any} Fake request
 */
function fakeRequest(headers: Record<string, string>, secure = false): any {
    return {
        secure,
        get: (name: string) => headers[name],
    };
}

test("Session cookie follows the request protocol", async (t) => {
    const dataDir = "./data/test-better-auth-cookie-secure";
    const testDb = new TestDB(dataDir);
    let httpServer: Server;
    let baseUrl = "";

    /**
     * Sign in through the real HTTP route
     * @param {Record<string, string>} headers Extra request headers
     * @returns {Promise<string>} The session cookie
     */
    async function signIn(headers: Record<string, string> = {}) {
        const res = await fetch(`${baseUrl}/api/auth/sign-in/username`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...headers,
            },
            body: JSON.stringify({
                username,
                password,
            }),
        });

        const body = await res.text();

        assert.strictEqual(res.status, 200, body);

        const cookies = res.headers.getSetCookie();
        const sessionCookie = cookies.find((cookie) => cookie.includes("session_token"));

        assert.ok(sessionCookie, `No session cookie in ${JSON.stringify(cookies)}`);

        return sessionCookie;
    }

    t.before(async () => {
        try {
            fs.rmSync(dataDir, { recursive: true, force: true });
        } catch {
            console.warn("Unable to remove the old test database, reusing it.");
        }

        await testDb.create();
        await auth(true);
        await auth().api.createUser({
            body: {
                name: username,
                email: `${username}@noreply.uptime-kuma.internal`,
                password,
                role: "admin",
                data: {
                    username,
                },
            },
        });

        const { createBetterAuthRouter } = await import("../../server/routers/better-auth-router");
        const app = express();
        app.use(express.json());
        app.use(await createBetterAuthRouter());

        httpServer = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => httpServer.once("listening", resolve));
        baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
    });

    t.after(async () => {
        await new Promise((resolve) => {
            httpServer.close(() => resolve(null));
            httpServer.closeAllConnections();
        });
        await testDb.destroy();
    });

    // Better Auth allows only 3 sign-in attempts per 10 seconds
    await t.test("sign-in marks the session cookie Secure for an https browser origin", async () => {
        const sessionCookie = await signIn({
            origin: "https://kuma.example.com",
        });

        assert.match(sessionCookie, /;\s*Secure/i);
    });

    await t.test("sign-in keeps the session cookie plain for a plain http origin", async () => {
        const sessionCookie = await signIn({
            origin: "http://192.168.1.2:3000",
        });

        assert.doesNotMatch(sessionCookie, /;\s*Secure/i);
    });

    await t.test("sign-in marks the session cookie Secure behind a proxy that reports https", async () => {
        const sessionCookie = await signIn({
            "x-forwarded-proto": "https",
        });

        assert.match(sessionCookie, /;\s*Secure/i);
    });
});

test("shouldSecureCookies reads the browser and proxy hints", async (t) => {
    await t.test("returns true for a TLS socket", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({}, true)), true);
    });

    await t.test("returns false when nothing reports https", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({})), false);
    });

    await t.test("returns true for an https origin", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ origin: "https://kuma.example.com" })), true);
    });

    await t.test("returns false for an http origin", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ origin: "http://192.168.1.2:3000" })), false);
    });

    await t.test("returns true for an https referer of the same host", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ referer: "https://kuma.example.com/dashboard" })), true);
    });

    await t.test("returns false for an http referer", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ referer: "http://192.168.1.2:3000/dashboard" })), false);
    });

    await t.test("trusts an https referer from another site (benign false positive)", () => {
        // A plain http session reached from an https link still gets a Secure cookie, which the browser drops
        assert.strictEqual(shouldSecureCookies(fakeRequest({ referer: "https://another-site.example/page" })), true);
    });

    await t.test("trusts a referer that only starts with https://", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ referer: "https://" })), true);
    });

    await t.test("returns false for a referer that is not a URL", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ referer: "kuma.example.com/dashboard" })), false);
    });

    await t.test("returns false for a null origin", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ origin: "null" })), false);
    });

    await t.test("prefers a plain http origin over an https referer", () => {
        assert.strictEqual(
            shouldSecureCookies(
                fakeRequest({
                    origin: "http://192.168.1.2:3000",
                    referer: "https://kuma.example.com/dashboard",
                })
            ),
            false
        );
    });

    await t.test("returns true for a proxy that reports https", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ "x-forwarded-proto": "https" })), true);
    });

    await t.test("returns false for a proxy that reports http", () => {
        assert.strictEqual(shouldSecureCookies(fakeRequest({ "x-forwarded-proto": "http" })), false);
    });

    await t.test("ignores proxy https when the browser says http", () => {
        assert.strictEqual(
            shouldSecureCookies(
                fakeRequest({
                    origin: "http://192.168.1.2:3000",
                    "x-forwarded-proto": "https",
                })
            ),
            false
        );
    });
});
