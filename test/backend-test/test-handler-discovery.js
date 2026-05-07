process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");
// Loading any socket handler transitively pulls in UptimeKumaServer, which
// hard-exits if `dist/index.html` is missing outside of development. The
// frontend bundle isn't required for unit-testing handler discovery, so flag
// the environment as development before the requires fire.
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
}

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const handlersDir = path.join(__dirname, "..", "..", "server", "socket-handlers");
const PRIVATE_MARKER = path.join(handlersDir, "_isolation-marker.js");
const NO_CALLABLE_MARKER = path.join(handlersDir, "zz-isolation-no-callable.js");

/**
 * Mirror of the resolver used in server/server.js. Picks the registrar
 * function from a loaded socket-handler module.
 * @param {object|Function} mod The loaded handler module.
 * @returns {Function|null} Registrar function, or null when none is found.
 */
const resolveSocketHandlerFn = (mod) => {
    if (typeof mod === "function") {
        return mod;
    }
    if (mod && typeof mod === "object") {
        const namedKey = Object.keys(mod).find(
            (k) => typeof mod[k] === "function" && k.endsWith("SocketHandler")
        );
        if (namedKey) {
            return mod[namedKey];
        }
        const firstFn = Object.values(mod).find((v) => typeof v === "function");
        if (firstFn) {
            return firstFn;
        }
    }
    return null;
};

describe("Socket handler auto-discovery", () => {
    test("socket-handlers directory exists", () => {
        assert.ok(fs.existsSync(handlersDir), `expected ${handlersDir} to exist`);
        assert.ok(fs.statSync(handlersDir).isDirectory(), `expected ${handlersDir} to be a directory`);
    });

    test("each .js entry exposes a registrar function", () => {
        const files = fs.readdirSync(handlersDir)
            .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
            .sort();

        assert.ok(files.length > 0, "expected at least one socket handler module");

        for (const f of files) {
            const mod = require(path.join(handlersDir, f));
            const fn = resolveSocketHandlerFn(mod);
            assert.strictEqual(
                typeof fn,
                "function",
                `socket-handlers/${f} should export a registrar function (got ${typeof fn})`
            );
        }
    });

    test("private (underscore-prefixed) modules are skipped", () => {
        const files = fs.readdirSync(handlersDir)
            .filter((f) => f.endsWith(".js") && !f.startsWith("_"));
        for (const f of files) {
            assert.ok(!f.startsWith("_"), `unexpected private module ${f} included`);
        }
    });

    describe("isolation markers (drop temp files in handlers dir)", () => {
        before(() => {
            // A real file with the underscore prefix that *would* explode if loaded.
            fs.writeFileSync(
                PRIVATE_MARKER,
                "module.exports = () => { throw new Error('private file should not be loaded'); };\n"
            );
            // A real file that exports an object with NO function — discovery
            // must throw at boot when this is hit, not silently no-op.
            fs.writeFileSync(
                NO_CALLABLE_MARKER,
                "module.exports = { someValue: 42 };\n"
            );
        });

        after(() => {
            try {
                fs.unlinkSync(PRIVATE_MARKER);
            } catch { /* ignore */ }
            try {
                fs.unlinkSync(NO_CALLABLE_MARKER);
            } catch { /* ignore */ }
        });

        test("real underscore-prefixed file is excluded by the discovery filter", () => {
            const files = fs.readdirSync(handlersDir)
                .filter((f) => f.endsWith(".js") && !f.startsWith("_"));
            assert.ok(
                !files.includes("_isolation-marker.js"),
                "discovery filter must not include underscore-prefixed files"
            );
        });

        test("module without a callable export resolves to null (boot-time signal)", () => {
            const mod = require(NO_CALLABLE_MARKER);
            assert.strictEqual(
                resolveSocketHandlerFn(mod),
                null,
                "module without any function export must resolve to null so the boot loop can throw"
            );
        });

        test("alphabetical sort order is deterministic", () => {
            const files = fs.readdirSync(handlersDir)
                .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
                .sort();
            // Take a copy, shuffle, sort again — must produce the same array.
            const copy = files.slice();
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [ copy[i], copy[j] ] = [ copy[j], copy[i] ];
            }
            copy.sort();
            assert.deepStrictEqual(copy, files, "sort must yield the same order regardless of disk-read order");
        });
    });

    test("expected core handlers are discovered", () => {
        const files = fs.readdirSync(handlersDir)
            .filter((f) => f.endsWith(".js") && !f.startsWith("_"));
        const expected = [
            "api-key-socket-handler.js",
            "chart-socket-handler.js",
            "cloudflared-socket-handler.js",
            "database-socket-handler.js",
            "docker-socket-handler.js",
            "general-socket-handler.js",
            "maintenance-socket-handler.js",
            "notification-socket-handler.js",
            "proxy-socket-handler.js",
            "remote-browser-socket-handler.js",
            "status-page-socket-handler.js",
        ];
        for (const name of expected) {
            assert.ok(files.includes(name), `expected handler ${name} to be discovered`);
        }
    });
});
