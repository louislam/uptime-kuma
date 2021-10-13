module.exports = {
    "verbose": true,
    "preset": "jest-puppeteer",
    "globals": {
        "__DEV__": true
    },
    "testRegex": "./test/e2e.spec.js",
    "rootDir": "..",
    "testTimeout": 30000,
};

