process.env.UPTIME_KUMA_HIDE_LOG = ["error_socket", "info_server"].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert");
const { socketError, UserFacingError } = require("../../server/utils/socket-error");

describe("socketError helper", () => {
    test("returns the generic fallback message for plain Error", () => {
        let received = null;
        const cb = (payload) => {
            received = payload;
        };

        socketError(cb, new Error("DB constraint failed"), "Could not save");

        assert.deepStrictEqual(received, {
            ok: false,
            msg: "Could not save",
        });
    });

    test("passes through the error message for UserFacingError", () => {
        let received = null;
        const cb = (payload) => {
            received = payload;
        };

        socketError(cb, new UserFacingError("Username taken"));

        assert.deepStrictEqual(received, {
            ok: false,
            msg: "Username taken",
        });
    });

    test("uses the provided fallback when err is null", () => {
        let received = null;
        const cb = (payload) => {
            received = payload;
        };

        socketError(cb, null, "fallback");

        assert.deepStrictEqual(received, {
            ok: false,
            msg: "fallback",
        });
    });

    test("falls back to a generic message when no userMsg is supplied", () => {
        let received = null;
        const cb = (payload) => {
            received = payload;
        };

        socketError(cb, new Error("internal SQL error"));

        assert.strictEqual(received.ok, false);
        assert.strictEqual(received.msg, "An unexpected error occurred");
        // Real error must NOT leak.
        assert.ok(!String(received.msg).includes("SQL"));
    });

    test("respects msgi18n on translation-key errors", () => {
        let received = null;
        const cb = (payload) => {
            received = payload;
        };

        // Imitates a TranslatableError.
        const err = new Error("passwordTooWeak");
        err.msgi18n = true;

        socketError(cb, err, "fallback");

        assert.deepStrictEqual(received, {
            ok: false,
            msg: "passwordTooWeak",
            msgi18n: true,
        });
    });
});

describe("UserFacingError", () => {
    test("instances flag isUserFacing", () => {
        const err = new UserFacingError("Invalid input");
        assert.strictEqual(err.isUserFacing, true);
        assert.strictEqual(err.message, "Invalid input");
        assert.ok(err instanceof Error);
    });
});
