import { describe, test } from "node:test";
import assert from "node:assert";
import { BeatVersionThrottle } from "../../src/beat-version-throttle";

describe("BeatVersionThrottle", () => {
    test("bumps at most once per interval", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });

        let bumps = 0;
        const throttle = new BeatVersionThrottle(() => bumps++, 1000);

        throttle.schedule();
        throttle.schedule();
        throttle.schedule();
        assert.strictEqual(bumps, 0);

        t.mock.timers.tick(999);
        assert.strictEqual(bumps, 0);

        t.mock.timers.tick(1);
        assert.strictEqual(bumps, 1);
    });

    test("can bump again after the interval elapsed", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });

        let bumps = 0;
        const throttle = new BeatVersionThrottle(() => bumps++, 1000);

        throttle.schedule();
        t.mock.timers.tick(1000);
        assert.strictEqual(bumps, 1);

        throttle.schedule();
        t.mock.timers.tick(1000);
        assert.strictEqual(bumps, 2);
    });

    test("cancel() drops the pending bump", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });

        let bumps = 0;
        const throttle = new BeatVersionThrottle(() => bumps++, 1000);

        throttle.schedule();
        throttle.cancel();
        t.mock.timers.tick(1000);

        assert.strictEqual(bumps, 0);
    });
});
