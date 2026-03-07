const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { loadPlugins } = require("../../server/utils/plugin-loader");

class BaseType {
    name = undefined;
}

describe("loadPlugins", () => {
    describe("directory handling", () => {
        test("throws when directory does not exist", () => {
            assert.throws(
                () => loadPlugins("/non/existent/path", BaseType, () => {}),
                (err) => {
                    assert.ok(err instanceof Error);
                    assert.ok(err.message.includes("/non/existent/path"));
                    return true;
                }
            );
        });

        test("skips non-.js files", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-nonjs-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "plugin.txt"), "not js");
                fs.writeFileSync(path.join(fixtureDir, "README.md"), "# docs");
                loadPlugins(fixtureDir, BaseType, (instance) => registered.push(instance));
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 0);
        });
    });

    describe("require errors", () => {
        test("throws if a plugin file has a syntax error", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-err-"));
            try {
                fs.writeFileSync(path.join(fixtureDir, "bad-plugin.js"), "this is not valid javascript !!!");
                assert.throws(
                    () => loadPlugins(fixtureDir, BaseType, () => {}),
                    (err) => {
                        assert.ok(err instanceof Error);
                        assert.ok(err.message.includes("bad-plugin.js"));
                        return true;
                    }
                );
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
        });
    });

    describe("class filtering", () => {
        test("skips exports that are not functions", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-nonfn-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "non-class.js"), "module.exports = { foo: 42, bar: 'hello' };");
                loadPlugins(fixtureDir, BaseType, (instance) => registered.push(instance));
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 0);
        });

        test("skips classes that do not extend the base type", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-wrongbase-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "wrong-base.js"), `
                    class WrongBase { name = "wrong"; }
                    module.exports = WrongBase;
                `);
                loadPlugins(fixtureDir, BaseType, (instance) => registered.push(instance));
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 0);
        });

        test("skips the base class itself", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-baseself-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "base.js"), `
                    class BaseType { name = undefined; }
                    module.exports = BaseType;
                `);
                // A locally-defined class with the same shape but different identity
                // confirms the instanceof check works correctly.
                loadPlugins(fixtureDir, BaseType, (instance) => registered.push(instance));
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 0);
        });
    });

    describe("valid plugin loading", () => {
        test("loads a plugin exported as module.exports = Class (direct export)", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-direct-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "base.js"), `
                    class BaseType { name = undefined; }
                    module.exports = { BaseType };
                `);
                fs.writeFileSync(path.join(fixtureDir, "plugin.js"), `
                    const { BaseType } = require(${JSON.stringify(path.join(fixtureDir, "base.js"))});
                    class MyPlugin extends BaseType { name = "my-plugin"; }
                    module.exports = MyPlugin;
                `);

                const Base = require(path.join(fixtureDir, "base.js")).BaseType;
                loadPlugins(fixtureDir, Base, (instance, filename) => {
                    if (filename !== "base.js") {
                        registered.push(instance);
                    }
                });
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 1);
            assert.strictEqual(registered[0].name, "my-plugin");
        });

        test("loads a plugin exported as module.exports = { Class } (named export)", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-named-"));
            const registered = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "base.js"), `
                    class BaseType { name = undefined; }
                    module.exports = { BaseType };
                `);
                fs.writeFileSync(path.join(fixtureDir, "plugin.js"), `
                    const { BaseType } = require(${JSON.stringify(path.join(fixtureDir, "base.js"))});
                    class MyNamedPlugin extends BaseType { name = "my-named-plugin"; }
                    module.exports = { MyNamedPlugin };
                `);

                const Base = require(path.join(fixtureDir, "base.js")).BaseType;
                loadPlugins(fixtureDir, Base, (instance, filename) => {
                    if (filename !== "base.js") {
                        registered.push(instance);
                    }
                });
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
            assert.strictEqual(registered.length, 1);
            assert.strictEqual(registered[0].name, "my-named-plugin");
        });

        test("calls registerFn with instance and filename", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-meta-"));
            const calls = [];
            try {
                fs.writeFileSync(path.join(fixtureDir, "base.js"), `
                    class BaseType { name = undefined; }
                    module.exports = { BaseType };
                `);
                fs.writeFileSync(path.join(fixtureDir, "plugin.js"), `
                    const { BaseType } = require(${JSON.stringify(path.join(fixtureDir, "base.js"))});
                    class MetaPlugin extends BaseType { name = "meta"; }
                    module.exports = MetaPlugin;
                `);

                const Base = require(path.join(fixtureDir, "base.js")).BaseType;
                loadPlugins(fixtureDir, Base, (instance, filename) => {
                    calls.push({ instance, filename });
                });
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }

            const pluginCall = calls.find((c) => c.filename === "plugin.js");
            assert.ok(pluginCall, "registerFn was not called for plugin.js");
            assert.strictEqual(pluginCall.instance.name, "meta");
        });

        test("throws when plugin constructor fails", () => {
            const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-loader-ctor-"));

            try {
                fs.writeFileSync(path.join(fixtureDir, "base.js"), `
                    class BaseType {}
                    module.exports = { BaseType };
                `);

                fs.writeFileSync(path.join(fixtureDir, "plugin.js"), `
                    const { BaseType } = require(${JSON.stringify(path.join(fixtureDir, "base.js"))});
                    class BadPlugin extends BaseType {
                        constructor() { throw new Error("boom"); }
                    }
                    module.exports = BadPlugin;
                `);

                const Base = require(path.join(fixtureDir, "base.js")).BaseType;

                assert.throws(() => loadPlugins(fixtureDir, Base, () => {}));
            } finally {
                fs.rmSync(fixtureDir, { recursive: true, force: true });
            }
        });
    });
});
