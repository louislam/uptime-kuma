# Node.js Test Runner

Documentation: https://nodejs.org/api/test.html

Create a test file in this directory with the name `*.js`.

## Template

```js
const test = require("node:test");
const assert = require("node:assert");

test("Test name", async (t) => {
    assert.strictEqual(1, 1);
});
```

## Run

```bash
npm run test-backend
```
