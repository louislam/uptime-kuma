const semver = require("semver");
let test;
const nodeVersion = process.versions.node;
// Node.js version >= 18
if (semver.satisfies(nodeVersion, ">= 18")) {
    test = require("node:test");
} else {
    test = require("test");
}

const assert = require("node:assert");
const describe = test.describe;
const it = test.it;
const mock = test.mock;

module.exports = {
    test,
    assert,
    describe,
    it,
    mock,
};
