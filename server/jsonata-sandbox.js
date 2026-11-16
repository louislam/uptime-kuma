const vm = require("node:vm");
const fs = require("node:fs");

// jsonata <= 2.2.2 can reach the host Function from an expression (jsonata#859), so run it in a vm context.
/** Compute, memory and run time limits for one expression: https://docs.jsonata.org/guardrails */
const JSONATA_GUARDRAILS = { timeout: 1000, stack: 500, sequence: 10000 };

/** Compiled sandbox scripts, built on first use. */
let sandboxScripts = null;

/**
 * Compile the scripts that load jsonata inside a vm context.
 * @returns {object} Compiled jsonata loader and evaluation wrapper
 */
function getSandboxScripts() {
    if (!sandboxScripts) {
        sandboxScripts = {
            // Runs inside the context, so expressions cannot reach host realm functions.
            source: new vm.Script(fs.readFileSync(require.resolve("jsonata"), "utf8"), { filename: "jsonata.js" }),
            // Results and errors cross the boundary as JSON text, never as objects.
            evaluate: new vm.Script(`(function (expression, dataJson) {
                var compiled = jsonata(expression, ${JSON.stringify(JSONATA_GUARDRAILS)});
                return compiled.evaluate(JSON.parse(dataJson)).then(function (result) {
                    return JSON.stringify({ ok: true, defined: result !== undefined, value: result });
                }, function (error) {
                    return JSON.stringify({ ok: false, message: (error && error.message) || String(error) });
                });
            })`),
        };
    }
    return sandboxScripts;
}

/**
 * Evaluate a JSONata expression in a sandboxed vm context.
 * @param {string} expression JSONata expression from a monitor's JSON query field
 * @param {any} data Data to evaluate against
 * @returns {Promise<any>} Result of the evaluation
 */
async function jsonataSandbox(expression, data) {
    const scripts = getSandboxScripts();
    const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
    vm.runInContext("var module = { exports: {} }; var exports = module.exports;", context);
    scripts.source.runInContext(context);
    vm.runInContext("var jsonata = module.exports;", context);

    const dataJson = JSON.stringify(data === undefined ? null : data);
    const outcome = JSON.parse(await scripts.evaluate.runInContext(context)(expression, dataJson));
    if (!outcome.ok) {
        throw new Error(outcome.message);
    }
    return outcome.value;
}

/**
 * Evaluate a JSON query expression against the provided data.
 * @param {any} data The data to evaluate the JSON query against.
 * @param {string} jsonPath The JSON path or custom JSON query expression.
 * @param {string} jsonPathOperator The operator to use for comparison.
 * @param {any} expectedValue The expected value to compare against.
 * @returns {Promise<object>} An object containing the status and the evaluation result.
 * @throws Error if the evaluation returns undefined.
 */
async function evaluateJsonQuery(data, jsonPath, jsonPathOperator, expectedValue) {
    // Attempt to parse data as JSON; if unsuccessful, handle based on data type.
    let response;
    try {
        response = JSON.parse(data);
    } catch {
        response =
            (typeof data === "object" || typeof data === "number") && !Buffer.isBuffer(data) ? data : data.toString();
    }

    try {
        // If a JSON path is provided, pre-evaluate the data using it.
        response = jsonPath ? await jsonataSandbox(jsonPath, response) : response;

        if (response === null || response === undefined) {
            throw new Error("Empty or undefined response. Check query syntax and response structure");
        }

        // Check for arrays: JSONata filter expressions like .[predicate] always return arrays
        if (Array.isArray(response)) {
            const responseStr = JSON.stringify(response);
            const truncatedResponse = responseStr.length > 25 ? responseStr.substring(0, 25) + "...]" : responseStr;
            throw new Error(
                "JSON query returned the array " +
                    truncatedResponse +
                    ", but a primitive value is required. " +
                    "Modify your query to return a single value via [0] to get the first element or use an aggregation like $count(), $sum() or $boolean()."
            );
        }

        if (typeof response === "object" || response instanceof Date || typeof response === "function") {
            throw new Error(
                `The post-JSON query evaluated response from the server is of type ${typeof response}, which cannot be directly compared to the expected value`
            );
        }

        // Perform the comparison logic using the chosen operator
        let jsonQueryExpression;
        switch (jsonPathOperator) {
            case ">":
            case ">=":
            case "<":
            case "<=":
                jsonQueryExpression = `$number($.value) ${jsonPathOperator} $number($.expected)`;
                break;
            case "!=":
                jsonQueryExpression = "$.value != $.expected";
                break;
            case "==":
                jsonQueryExpression = "$.value = $.expected";
                break;
            case "contains":
                jsonQueryExpression = "$contains($.value, $.expected)";
                break;
            default:
                throw new Error(`Invalid condition ${jsonPathOperator}`);
        }

        // Evaluate the JSON Query Expression
        const status = await jsonataSandbox(jsonQueryExpression, {
            value: response.toString(),
            expected: expectedValue.toString(),
        });

        if (status === undefined) {
            throw new Error(
                "Query evaluation returned undefined. Check query syntax and the structure of the response data"
            );
        }

        return {
            status, // The evaluation of the json query
            response, // The response from the server or result from initial json-query evaluation
        };
    } catch (err) {
        response = JSON.stringify(response); // Ensure the response is treated as a string for the console
        response = response && response.length > 50 ? `${response.substring(0, 100)}… (truncated)` : response; // Truncate long responses to the console
        throw new Error(`Error evaluating JSON query: ${err.message}. Response from server was: ${response}`);
    }
}

module.exports = {
    jsonataSandbox,
    evaluateJsonQuery,
};
