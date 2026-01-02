# Node.js Test Runner

Documentation: https://nodejs.org/api/test.html

Create a test file in this directory with the name `*.js`.

> [!TIP]
> Writing great tests is hard.
> 
> You can make our live much simpler by following this guidance:
> - Use `describe()` to group related tests
> - Use `test()` for individual test cases
> - One test per scenario
> - Use descriptive test names: `function() [behavior] [condition]`
> - Don't prefix with "Test" or "Should"

## Template

```js
const { describe, test } = require("node:test");
const assert = require("node:assert");

describe("Feature Name", () => {
    test("function() returns expected value when condition is met", () => {
        assert.strictEqual(1, 1);
    });
});
```

## Run

```bash
npm run test-backend
```
