const semver = require("semver");
let test;
const nodeVersion = process.versions.node;
if (semver.satisfies(nodeVersion, ">= 18")) {
    test = require("node:test");
} else {
    test = require("test");
}
const apicacheModule = require("../../server/modules/apicache/apicache.js");

const assert = require("node:assert");

test("Test ReDos - attack string", async (t) => {
  const getDuration = apicacheModule.getDuration;
  const str = "" + "00".repeat(100000) + "\u0000";
  const startTime = performance.now();
  try {
    getDuration(str);
  } catch (error) {
    // pass
  }
  const endTime = performance.now();
  const elapsedTime = endTime - startTime;
  const reDosThreshold = 9000;
  assert(elapsedTime <= reDosThreshold, `🚨 Potential ReDoS Attack! getDuration method took ${elapsedTime.toFixed(2)} ms, exceeding threshold of ${reDosThreshold} ms.`);
});
