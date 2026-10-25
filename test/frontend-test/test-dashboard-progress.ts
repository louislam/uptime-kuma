import { describe, test } from "node:test";
import assert from "node:assert";
import {
    CREEP_INTERVAL_MS,
    DashboardProgress,
    FINISH_DELAY_MS,
    MAX_CREEP,
    ROUTE_PROGRESS,
    SAFETY_MS,
    SHOW_DELAY_MS,
} from "../../src/dashboard-progress";

describe("DashboardProgress", () => {
    test("shows the overlay only after the short delay", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const progress = new DashboardProgress();

        progress.update(8);
        assert.strictEqual(progress.visible, false);

        t.mock.timers.tick(SHOW_DELAY_MS - 1);
        assert.strictEqual(progress.visible, false);

        t.mock.timers.tick(1);
        assert.strictEqual(progress.visible, true);
        assert.strictEqual(progress.value, 8);
    });

    test("crawls toward the maximum while waiting", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const progress = new DashboardProgress();
        progress.update(10);

        t.mock.timers.tick(SHOW_DELAY_MS);
        t.mock.timers.tick(CREEP_INTERVAL_MS);
        const afterOneTick = progress.value;
        assert.ok(afterOneTick > 10);

        t.mock.timers.tick(CREEP_INTERVAL_MS * 1000);
        assert.strictEqual(progress.value, MAX_CREEP);
    });

    test("fills the bar and hides it after finishing", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const progress = new DashboardProgress();
        progress.update(50);
        t.mock.timers.tick(SHOW_DELAY_MS);

        progress.update(100);
        assert.strictEqual(progress.value, 100);
        assert.strictEqual(progress.visible, true);

        t.mock.timers.tick(FINISH_DELAY_MS);
        assert.strictEqual(progress.visible, false);
    });

    test("hides the overlay after the safety timeout", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const progress = new DashboardProgress();
        progress.update(20);
        t.mock.timers.tick(SHOW_DELAY_MS);
        assert.strictEqual(progress.visible, true);

        t.mock.timers.tick(SAFETY_MS);
        assert.strictEqual(progress.visible, false);
    });

    test("resets on zero progress and stops the creep", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        const progress = new DashboardProgress();
        progress.update(30);
        t.mock.timers.tick(SHOW_DELAY_MS);

        progress.update(0);
        assert.strictEqual(progress.visible, false);
        assert.strictEqual(progress.value, 0);

        t.mock.timers.tick(CREEP_INTERVAL_MS * 100);
        assert.strictEqual(progress.value, 0);
    });

    test("does not move backwards on a lower update", () => {
        const progress = new DashboardProgress();

        progress.update(60);
        progress.update(20);

        assert.strictEqual(progress.value, 60);
        progress.clearTimers();
    });

    test("marks the dashboard route with a small step only once", () => {
        const progress = new DashboardProgress();

        assert.strictEqual(progress.routeProgress("/dashboard", 0), ROUTE_PROGRESS);
        assert.strictEqual(progress.routeProgress("/dashboard", ROUTE_PROGRESS), ROUTE_PROGRESS);
        assert.strictEqual(progress.routeProgress("/settings", 0), 0);
    });

    test("does not start the bar when opening a monitor detail page", () => {
        const progress = new DashboardProgress();

        assert.strictEqual(progress.routeProgress("/dashboard/61", 0), 0);
        assert.strictEqual(progress.routeProgress("/dashboard/61/edit", 0), 0);
    });

    test("notifies the app on every change", (t) => {
        t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
        let changes = 0;
        const progress = new DashboardProgress(() => changes++);

        progress.update(10);
        t.mock.timers.tick(SHOW_DELAY_MS);
        const afterShow = changes;

        progress.update(100);
        t.mock.timers.tick(FINISH_DELAY_MS);

        assert.ok(afterShow >= 2);
        assert.ok(changes > afterShow);
    });
});
