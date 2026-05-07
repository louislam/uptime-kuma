// Hide the noisy startup logs so the test runner output stays clean,
// but allow `monitor` warn/debug lines through so we can assert on them.
process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const { safeJsonParse } = require("../../server/utils/safe-json");
const { log } = require("../../src/util");

/**
 * Capture calls to `log.warn` / `log.debug` for the duration of one
 * test, returning a restore function and the collected calls array.
 * @returns {{ calls: Array<{level: string, args: Array}>, restore: Function }}
 *   Captured calls and a restore function.
 */
function captureLog() {
    const calls = [];
    const origWarn = log.warn;
    const origDebug = log.debug;
    log.warn = (...args) => calls.push({ level: "warn",
        args });
    log.debug = (...args) => calls.push({ level: "debug",
        args });
    return {
        calls,
        restore() {
            log.warn = origWarn;
            log.debug = origDebug;
        },
    };
}

describe("safeJsonParse", () => {
    let captured;

    beforeEach(() => {
        captured = captureLog();
    });

    afterEach(() => {
        captured.restore();
    });

    test("returns parsed value for valid JSON object", () => {
        const result = safeJsonParse('{"a":1,"b":"x"}', null, "field");
        assert.deepStrictEqual(result, { a: 1,
            b: "x" });
        assert.strictEqual(captured.calls.length, 0, "should not log on success");
    });

    test("returns parsed value for valid JSON array", () => {
        const result = safeJsonParse("[1,2,3]", [], "field");
        assert.deepStrictEqual(result, [ 1, 2, 3 ]);
        assert.strictEqual(captured.calls.length, 0);
    });

    test("returns parsed value for valid JSON primitives", () => {
        assert.strictEqual(safeJsonParse("42", null, "n"), 42);
        assert.strictEqual(safeJsonParse('"hello"', null, "s"), "hello");
        assert.strictEqual(safeJsonParse("true", null, "b"), true);
        assert.strictEqual(safeJsonParse("null", "fallback", "n"), null);
        assert.strictEqual(captured.calls.length, 0);
    });

    test("returns fallback and logs warn for invalid JSON", () => {
        const fallback = [ "200" ];
        const result = safeJsonParse("{not valid json", fallback, "accepted_statuscodes_json");
        assert.deepStrictEqual(result, fallback);
        assert.strictEqual(captured.calls.length, 1);
        assert.strictEqual(captured.calls[0].level, "warn");
        // First arg is the module; second is the message.
        assert.strictEqual(captured.calls[0].args[0], "monitor");
        assert.match(captured.calls[0].args[1], /accepted_statuscodes_json/);
    });

    test("returns fallback and logs debug when level=debug", () => {
        const result = safeJsonParse("not-json", null, "monitor_tls_info.info_json", "debug");
        assert.strictEqual(result, null);
        assert.strictEqual(captured.calls.length, 1);
        assert.strictEqual(captured.calls[0].level, "debug");
        assert.match(captured.calls[0].args[1], /monitor_tls_info\.info_json/);
    });

    test("returns fallback without logging for null", () => {
        const fallback = [];
        const result = safeJsonParse(null, fallback, "field");
        assert.strictEqual(result, fallback);
        assert.strictEqual(captured.calls.length, 0);
    });

    test("returns fallback without logging for undefined", () => {
        const fallback = {};
        const result = safeJsonParse(undefined, fallback, "field");
        assert.strictEqual(result, fallback);
        assert.strictEqual(captured.calls.length, 0);
    });

    test("returns fallback without logging for empty string", () => {
        const fallback = [ "200" ];
        const result = safeJsonParse("", fallback, "field");
        assert.strictEqual(result, fallback);
        assert.strictEqual(captured.calls.length, 0);
    });

    test("preserves identity of fallback (no cloning)", () => {
        const fallback = { sentinel: true };
        const result = safeJsonParse("garbage", fallback, "x");
        assert.strictEqual(result, fallback);
    });
});
