import { describe, test } from "node:test";
import assert from "node:assert";
import {
    buildDashboardFilterQuery,
    parseDashboardFilterQuery,
    queryValueToArray,
} from "../../src/dashboard-filter-query";

describe("queryValueToArray()", () => {
    test("returns an empty array for missing values", () => {
        assert.deepStrictEqual(queryValueToArray(undefined), []);
        assert.deepStrictEqual(queryValueToArray(null), []);
        assert.deepStrictEqual(queryValueToArray(""), []);
    });

    test("normalises a single string and an array of strings", () => {
        assert.deepStrictEqual(queryValueToArray("0"), ["0"]);
        assert.deepStrictEqual(queryValueToArray(["0", "1"]), ["0", "1"]);
    });
});

describe("parseDashboardFilterQuery()", () => {
    test("returns null fields when no filter params are present", () => {
        assert.deepStrictEqual(parseDashboardFilterQuery({}), {
            status: null,
            active: null,
            tags: null,
        });
    });

    test("parses status, active, and tags from query params", () => {
        assert.deepStrictEqual(
            parseDashboardFilterQuery({
                status: ["0", "1"],
                active: "false",
                tags: ["3", "5"],
            }),
            {
                status: [0, 1],
                active: [false],
                tags: [3, 5],
            }
        );
    });

    test("ignores invalid status, active, and tag values", () => {
        assert.deepStrictEqual(
            parseDashboardFilterQuery({
                status: ["9", "abc", "2"],
                active: ["yes", "true"],
                tags: ["0", "-1", "4.5", "7"],
            }),
            {
                status: [2],
                active: [true],
                tags: [7],
            }
        );
    });
});

describe("buildDashboardFilterQuery()", () => {
    test("writes filter params and preserves unrelated query keys", () => {
        assert.deepStrictEqual(
            buildDashboardFilterQuery(
                { collapse: "1", status: "9" },
                {
                    status: [0],
                    active: [true, false],
                    tags: [3],
                }
            ),
            {
                collapse: "1",
                status: ["0"],
                active: ["true", "false"],
                tags: ["3"],
            }
        );
    });

    test("omits empty filter keys so the URL stays clean", () => {
        assert.deepStrictEqual(
            buildDashboardFilterQuery(
                { status: "0", active: "true", tags: "1", other: "x" },
                {
                    status: null,
                    active: [],
                    tags: null,
                }
            ),
            { other: "x" }
        );
    });
});
