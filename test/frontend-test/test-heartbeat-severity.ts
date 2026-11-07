import assert from "node:assert/strict";
import { test } from "node:test";
import { getHeartbeatSeverityColor } from "../../src/heartbeat-severity";

test("severity colors follow the daily equivalent thresholds", () => {
    const palette = [
        [92, 221, 139],
        [255, 193, 7],
        [253, 126, 20],
        [220, 53, 69],
    ] as const;
    const cases: [number, string][] = [
        [0, "rgb(92, 221, 139)"],
        [Number.EPSILON, "rgb(92, 221, 139)"],
        [1 / 1440, "rgb(100, 220, 132)"],
        [20 / 1440, "rgb(255, 193, 7)"],
        [40 / 1440, "rgb(253, 126, 20)"],
        [60 / 1440, "rgb(220, 53, 69)"],
        [0.999, "rgb(220, 53, 69)"],
    ];
    for (const [ratio, expected] of cases) {
        assert.equal(getHeartbeatSeverityColor(ratio, palette), expected, `Failure ratio ${ratio}`);
    }
});
