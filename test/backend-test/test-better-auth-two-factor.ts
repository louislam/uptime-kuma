import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { R } from "redbean-node";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt } from "better-auth/crypto";
import { auth, getAuthSecret } from "../../server/better-auth";

// @ts-ignore
import TestDB from "../mock-testdb";

const dataDir = "./data/test-better-auth-two-factor";
const username = "two-factor-admin";
const password = "Kuma-Test-8f4Q2xR9p";

/**
 * Read the cookies of a better-auth response as a request Cookie header
 * @param headers Response headers
 * @returns Cookie header value
 */
function cookieFrom(headers: Headers) {
    return headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
}

test("Two-factor authentication", async (t) => {
    const testDb = new TestDB(dataDir);

    // The secret the user's authenticator app holds, decrypted from the database
    let totpSecret: string;

    // The backup codes better-auth returned when 2FA was enabled
    let backupCodes: string[];

    /**
     * Sign in with the username and password
     * @returns The login response and request headers carrying its cookies
     */
    async function signIn() {
        const result = await auth().api.signInUsername({
            body: { username, password },
            returnHeaders: true,
        });

        return {
            response: result.response,
            headers: new Headers({ cookie: cookieFrom(result.headers) }),
        };
    }

    /**
     * The TOTP code of this moment, as the user's authenticator app shows it
     * @returns The 6-digit code
     */
    function currentTOTP() {
        return createOTP(totpSecret).totp();
    }

    /**
     * Assert that a better-auth call fails with the expected error code
     * @param call The call to check
     * @param code The expected better-auth error code
     * @returns Resolves when the call failed as expected
     */
    async function assertAPIError(call: Promise<unknown>, code: string) {
        await assert.rejects(call, (error: any) => {
            assert.strictEqual(error.body?.code, code);
            return true;
        });
    }

    t.before(async () => {
        fs.rmSync(dataDir, { recursive: true, force: true });
        await testDb.create();
        await auth(true).api.createUser({
            body: {
                name: "admin",
                email: "admin@noreply.uptime-kuma.internal",
                password,
                role: "admin",
                data: { username },
            },
        });
    });

    t.after(async () => {
        await testDb.destroy();
    });

    await t.test("enabling 2FA needs the password", async () => {
        const { headers } = await signIn();

        await assertAPIError(
            auth().api.enableTwoFactor({
                body: { password: "not-the-password", issuer: "Uptime Kuma" },
                headers,
            }),
            "INVALID_PASSWORD"
        );

        assert.strictEqual(
            Number(await R.getCell("SELECT COUNT(*) FROM better_auth_twofactor")),
            0,
            "a rejected password must not create the 2FA row"
        );
    });

    await t.test("enabling 2FA stores the secret and the backup codes", async () => {
        const { headers } = await signIn();
        const enabled = await auth().api.enableTwoFactor({
            body: { password, issuer: "Uptime Kuma" },
            headers,
        });

        assert.strictEqual(enabled.method, "totp");
        assert.ok(
            enabled.totpURI.startsWith("otpauth://totp/Uptime%20Kuma:"),
            `unexpected TOTP URI: ${enabled.totpURI}`
        );
        assert.strictEqual(enabled.backupCodes.length, 10);
        backupCodes = enabled.backupCodes;

        const row = await R.knex("better_auth_twofactor").first();
        assert.ok(row, "the 2FA row was not created");
        assert.strictEqual(Number(row.verified), 0, "2FA must not be verified before the first code");
        assert.strictEqual(
            (await R.knex("better_auth_user").where({ username }).first()).twoFactorEnabled,
            0,
            "2FA must not be enabled before the first code"
        );

        // The encrypted codes are longer than the old varchar(255) column (#8273)
        assert.ok(row.backupCodes.length > 255, "the encrypted backup codes must exceed 255 characters");
        assert.deepStrictEqual(
            JSON.parse(await symmetricDecrypt({ key: getAuthSecret(), data: row.backupCodes })),
            backupCodes,
            "the stored backup codes do not match the ones given to the user"
        );

        totpSecret = await symmetricDecrypt({ key: getAuthSecret(), data: row.secret });
    });

    await t.test("a wrong TOTP code does not enable 2FA", async () => {
        const { headers } = await signIn();

        await assertAPIError(auth().api.verifyTOTP({ body: { code: "000000" }, headers }), "INVALID_CODE");
        assert.strictEqual(
            (await R.knex("better_auth_user").where({ username }).first()).twoFactorEnabled,
            0,
            "a wrong code must not enable 2FA"
        );
    });

    await t.test("the first valid TOTP code enables 2FA", async () => {
        const { headers } = await signIn();
        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });

        assert.strictEqual(
            (await R.knex("better_auth_twofactor").first()).verified,
            1,
            "the 2FA row must be marked as verified"
        );
        // The response carries the user as it was read before the update, so read it again
        const session = await auth().api.getSession({
            headers: new Headers({ cookie: cookieFrom(verified.headers) }),
        });
        assert.strictEqual(session?.user.twoFactorEnabled, true);
    });

    await t.test("the next sign-in asks for the second factor", async () => {
        const sessionsBefore = Number(await R.getCell("SELECT COUNT(*) FROM better_auth_session"));
        const { response } = await signIn();

        assert.strictEqual(response.twoFactorRedirect, true, "the password alone must not sign the user in");
        assert.strictEqual(response.token, undefined, "no session token must be handed out");
        assert.deepStrictEqual(response.twoFactorMethods, ["totp"]);
        assert.strictEqual(
            Number(await R.getCell("SELECT COUNT(*) FROM better_auth_session")),
            sessionsBefore,
            "the password alone must not create a session"
        );
    });

    await t.test("signing in with the TOTP code creates a session", async () => {
        const { headers } = await signIn();
        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });

        const session = await auth().api.getSession({
            headers: new Headers({ cookie: cookieFrom(verified.headers) }),
        });
        assert.strictEqual(session?.user.username, username);
        assert.strictEqual(session?.user.twoFactorEnabled, true);
    });

    await t.test("signing in with a backup code creates a session, and only once", async () => {
        const first = await signIn();
        const verified = await auth().api.verifyBackupCode({
            body: { code: backupCodes[0] },
            headers: first.headers,
            returnHeaders: true,
        });

        const session = await auth().api.getSession({
            headers: new Headers({ cookie: cookieFrom(verified.headers) }),
        });
        assert.strictEqual(session?.user.username, username);

        // The code the user just spent is not accepted a second time
        const second = await signIn();
        await assertAPIError(
            auth().api.verifyBackupCode({ body: { code: backupCodes[0] }, headers: second.headers }),
            "INVALID_BACKUP_CODE"
        );
    });

    await t.test("regenerating the backup codes invalidates the old ones", async () => {
        const { headers } = await signIn();
        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });
        const sessionHeaders = new Headers({ cookie: cookieFrom(verified.headers) });

        const regenerated = await auth().api.generateBackupCodes({
            body: { password },
            headers: sessionHeaders,
        });
        assert.strictEqual(regenerated.backupCodes.length, 10);
        assert.notDeepStrictEqual(regenerated.backupCodes, backupCodes);

        // An unused code from before the regeneration no longer works
        const { headers: challengeHeaders } = await signIn();
        await assertAPIError(
            auth().api.verifyBackupCode({ body: { code: backupCodes[1] }, headers: challengeHeaders }),
            "INVALID_BACKUP_CODE"
        );

        backupCodes = regenerated.backupCodes;
    });

    await t.test("disabling 2FA needs the password", async () => {
        const { headers } = await signIn();
        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });

        await assertAPIError(
            auth().api.disableTwoFactor({
                body: { password: "not-the-password" },
                headers: new Headers({ cookie: cookieFrom(verified.headers) }),
            }),
            "INVALID_PASSWORD"
        );

        assert.strictEqual(
            Number(await R.getCell("SELECT COUNT(*) FROM better_auth_twofactor")),
            1,
            "a rejected password must not remove the 2FA row"
        );
    });

    await t.test("the account is locked after 10 failed sign-in codes", async () => {
        // Each challenge allows 5 attempts, so use two of them
        for (let attempt = 0; attempt < 10; attempt++) {
            const { headers } = await signIn();
            await assertAPIError(auth().api.verifyTOTP({ body: { code: "000000" }, headers }), "INVALID_CODE");
        }

        const { headers } = await signIn();
        await assertAPIError(
            auth().api.verifyTOTP({ body: { code: await currentTOTP() }, headers }),
            "ACCOUNT_TEMPORARILY_LOCKED"
        );

        // Clear the lock for the remaining checks
        await R.knex("better_auth_twofactor").update({ failedVerificationCount: 0, lockedUntil: null });
    });

    await t.test("disabling 2FA removes the second factor from the next sign-in", async () => {
        const { headers } = await signIn();
        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });
        const sessionHeaders = new Headers({ cookie: cookieFrom(verified.headers) });

        const disabled = await auth().api.disableTwoFactor({
            body: { password },
            headers: sessionHeaders,
        });
        assert.strictEqual(disabled.status, true);
        assert.strictEqual(
            Number(await R.getCell("SELECT COUNT(*) FROM better_auth_twofactor")),
            0,
            "the 2FA row must be removed"
        );
        assert.strictEqual((await R.knex("better_auth_user").where({ username }).first()).twoFactorEnabled, 0);

        const { response } = await signIn();
        assert.strictEqual(response.twoFactorRedirect, undefined, "the password alone has to sign the user in");
        assert.ok(response.token, "a session token has to be returned");
    });

    await t.test("2FA can be enabled again after being disabled", async () => {
        const { headers } = await signIn();
        const enabled = await auth().api.enableTwoFactor({
            body: { password, issuer: "Uptime Kuma" },
            headers,
        });
        assert.strictEqual(enabled.backupCodes.length, 10);

        totpSecret = await symmetricDecrypt({
            key: getAuthSecret(),
            data: (await R.knex("better_auth_twofactor").first()).secret,
        });

        const verified = await auth().api.verifyTOTP({
            body: { code: await currentTOTP() },
            headers,
            returnHeaders: true,
        });
        const session = await auth().api.getSession({
            headers: new Headers({ cookie: cookieFrom(verified.headers) }),
        });
        assert.strictEqual(session?.user.twoFactorEnabled, true);

        const { response } = await signIn();
        assert.strictEqual(response.twoFactorRedirect, true);
    });
});
