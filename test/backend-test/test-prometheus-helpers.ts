import { describe, test } from "node:test";
import assert from "node:assert";
import { Prometheus } from "../../server/prometheus";

describe("Prometheus helpers", () => {
    describe("sanitizeForPrometheus()", () => {
        test("removes characters that are invalid in a label name", () => {
            assert.strictEqual(Prometheus.sanitizeForPrometheus("hello world!"), "helloworld");
        });

        test("removes a leading digit", () => {
            assert.strictEqual(Prometheus.sanitizeForPrometheus("123abc"), "abc");
        });

        test("keeps underscores and existing letters", () => {
            assert.strictEqual(Prometheus.sanitizeForPrometheus("_abc_123"), "_abc_123");
        });

        test("returns an empty string when nothing valid is left", () => {
            assert.strictEqual(Prometheus.sanitizeForPrometheus("!!!"), "");
        });

        test("removes separators inside a name", () => {
            assert.strictEqual(Prometheus.sanitizeForPrometheus("a-b.c"), "abc");
        });
    });

    describe("mapTagsToLabels()", () => {
        const mapTags = (tags) => Prometheus.prototype.mapTagsToLabels.call({ sortTags: Prometheus.sortTags }, tags);

        test("groups values by sanitized tag name and sorts them", () => {
            const labels = mapTags([
                { name: "env", value: "prod" },
                { name: "env", value: "dev" },
            ]);

            assert.deepStrictEqual(labels, { env: ["dev", "prod"] });
        });

        test("skips a tag name that sanitizes to nothing", () => {
            const labels = mapTags([{ name: "!!!", value: "x" }]);

            assert.deepStrictEqual(labels, {});
        });

        test("skips an empty tag value", () => {
            const labels = mapTags([{ name: "env", value: "" }]);

            assert.deepStrictEqual(labels, { env: [] });
        });

        test("keeps tag names ordered alphabetically", () => {
            const labels = mapTags([
                { name: "zone", value: "a" },
                { name: "env", value: "b" },
            ]);

            assert.deepStrictEqual(Object.keys(labels), ["env", "zone"]);
        });
    });
});
