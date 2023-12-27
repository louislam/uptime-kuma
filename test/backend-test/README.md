# Node.js Test Runner

Documentation: https://nodejs.org/api/test.html

Create a test file in this directory with the name `*.js`.

## Template

```js
const { assert, test, describe, it } = require("./util");

test("Test name", async (t) => {
    assert.strictEqual(1, 1);
});
```

## Run

Node.js >=18

```bash
npm run test-backend:18
```

Node.js < 18

```bash
npm run test-backend:14
```
