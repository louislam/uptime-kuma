import { describe, test } from "node:test";
import assert from "node:assert";
import { UptimeKumaServer } from "../../server/uptime-kuma-server";

describe("query parser", () => {
    test("keeps the first value of a repeated parameter", () => {
        const app = UptimeKumaServer.getInstance().app;
        const parseQueryString = app.get("query parser");
        const parsed = parseQueryString("status=up&msg=OK&msg=OK");

        assert.strictEqual(parsed.msg, "OK");
        assert.strictEqual(parsed.status, "up");
    });

    test("keeps single parameters unchanged", () => {
        const app = UptimeKumaServer.getInstance().app;
        const parseQueryString = app.get("query parser");
        const parsed = parseQueryString("msg=OK&ping=1.8");

        assert.deepStrictEqual(parsed, {
            msg: "OK",
            ping: "1.8",
        });
    });
});
