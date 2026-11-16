const { describe, test } = require("node:test");
const assert = require("node:assert");

const { jsonataSandbox, evaluateJsonQuery } = require("../../server/jsonata-sandbox");

// Payloads from https://github.com/jsonata-js/jsonata/issues/859, they obtain the host Function constructor.
const CARRIER = `$record := $clone({"first":0,"constructor":0,"undefined":0}); $clone := function($item){$item}; $record ~> | $ | {"__proto__":/audit/} |;`;
const ESCAPE_EACH = `(${CARRIER} $each($record, function($value,$key){ $key="first" ? ($record ~> | $ | {}, "constructor" |; 0) : ($key="constructor" and $type($value)="function" ? $value("return 13 * 17")() : 0) })[1])`;
const ESCAPE_LOOKUP = `(${CARRIER} $undefined := "constructor"; $worker := function(){0}; {"ref":$worker} ~> | ref | {}, "_jsonata_lambda" |; $advance := /q/("q!").next; $key := {"toString":$advance,"valueOf":$worker.environment.lookup}; $raw := $spread([$lookup]).implementation; $record ~> | $ | {}, "constructor" |; $selected := $raw($record, $key); $type($selected)="function" ? $selected("return 19 * 23")() : 0)`;
const ESCAPE_CONSTRUCTOR = `($hasOwnProperty := $spread($string); $__proto__ := $constructor; $constructor("return 1 + 1")())`;

describe("jsonataSandbox", () => {
    test("evaluates data queries", async () => {
        assert.strictEqual(await jsonataSandbox("$.data.temp", { data: { temp: 21 } }), 21);
        assert.strictEqual(await jsonataSandbox("$count($.items)", { items: [1, 2, 3] }), 3);
        assert.strictEqual(await jsonataSandbox("$.items[0].name", { items: [{ name: "a" }] }), "a");
    });

    test("keeps functions, lambdas and transforms", async () => {
        assert.deepStrictEqual(
            await jsonataSandbox("$map($.items, function($v){ $v * 2 })", { items: [1, 2] }),
            [2, 4]
        );
        assert.deepStrictEqual(
            await jsonataSandbox('$.items ~> | $ | {"double": float * 2} |', {
                items: [{ float: 1.5 }],
            }),
            [{ float: 1.5, double: 3 }]
        );
    });

    test("blocks code generation from strings", async () => {
        for (const expression of [ESCAPE_EACH, ESCAPE_LOOKUP, ESCAPE_CONSTRUCTOR]) {
            await assert.rejects(jsonataSandbox(expression, {}), (err) => {
                assert.match(err.message, /Code generation from strings disallowed|non-function/);
                return true;
            });
        }
    });

    test("stops runaway expressions", async () => {
        await assert.rejects(jsonataSandbox("( $inf := function(){ $inf() }; $inf() )", {}), /timeout/);
    });

    test("evaluateJsonQuery uses the sandbox", async () => {
        const ok = await evaluateJsonQuery(JSON.stringify({ temp: 21 }), "$.temp", ">", "20");
        assert.deepStrictEqual(ok, { status: true, response: 21 });
        await assert.rejects(
            evaluateJsonQuery("{}", ESCAPE_EACH, "==", "0"),
            /Code generation from strings disallowed/
        );
    });
});
