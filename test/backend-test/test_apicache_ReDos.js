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
  getDuration(str);
  const endTime = performance.now();
  const elapsedTime = endTime - startTime;
  const reDosThreshold = 9000;
  assert(elapsedTime <= reDosThreshold, `🚨 可能存在 ReDoS 攻击！getDuration 方法耗时 ${elapsedTime.toFixed(2)} 毫秒，超过阈值 ${reDosThreshold} 毫秒。`);
});