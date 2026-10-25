import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(import.meta.url);
const MemoryCache = require("../../server/modules/apicache/memory-cache");

describe("MemoryCache", () => {
    test("add() stores a value and updates the size", () => {
        const cache = new MemoryCache();

        cache.add("key", "value", 1000);

        assert.strictEqual(cache.size, 1);
        assert.strictEqual(cache.getValue("key"), "value");
    });

    test("get() returns the stored entry with its expiry", () => {
        const cache = new MemoryCache();
        const before = Date.now();

        cache.add("key", "value", 1000);

        const entry = cache.get("key");
        assert.strictEqual(entry.value, "value");
        assert.ok(entry.expire >= before + 1000);
    });

    test("delete() removes the entry and decreases the size", () => {
        const cache = new MemoryCache();
        cache.add("key", "value", 1000);

        cache.delete("key");

        assert.strictEqual(cache.size, 0);
        assert.strictEqual(cache.getValue("key"), undefined);
    });

    test("clear() empties the cache", () => {
        const cache = new MemoryCache();
        cache.add("a", 1, 1000);
        cache.add("b", 2, 1000);

        assert.strictEqual(cache.clear(), true);
        assert.strictEqual(cache.size, 0);
    });

    test("expires an entry after its ttl and calls the timeout callback", async () => {
        const cache = new MemoryCache();
        const removed = [];

        cache.add("key", "value", 20, (value, key) => removed.push([key, value]));
        assert.strictEqual(cache.getValue("key"), "value");

        await sleep(50);

        assert.strictEqual(cache.getValue("key"), undefined);
        assert.deepStrictEqual(removed, [["key", "value"]]);
    });
});
