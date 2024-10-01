import { test } from "@playwright/test";
import { restoreSqliteSnapshot } from "../util-test";
import { MonitorForm } from "./MonitorForm";

test.describe("Monitor Form", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    let monitorForm;

    test.beforeEach(async ({ page }) => {
        monitorForm = new MonitorForm(page);
    });

    test("condition ui", async ({ page }, testInfo) => {
        await monitorForm.navigateToAddPage();
        await monitorForm.login(testInfo);

        await monitorForm.selectMonitorType("dns");

        // Add Conditions & verify
        await monitorForm.addCondition();
        await monitorForm.verifyConditionCount(2); // 1 added by default + 1 explicitly added

        // Add a Condition Group & verify
        await monitorForm.addConditionGroup();
        await monitorForm.verifyConditionGroupCount(1);
        await monitorForm.verifyConditionCount(3); // 2 solo conditions + 1 condition in group

        await screenshot(testInfo, page);

        // Remove a condition & verify
        await monitorForm.removeCondition();
        await monitorForm.verifyConditionCount(2); // 1 solo condition + 1 condition in group

        // Remove a condition group & verify
        await monitorForm.removeConditionGroup();
        await monitorForm.verifyConditionGroupCount(0);

        await screenshot(testInfo, page);
    });

    test("successful condition", async ({ page }, testInfo) => {
        await monitorForm.navigateToAddPage();
        await monitorForm.login(testInfo);

        await monitorForm.selectMonitorType("dns");

        const friendlyName = "Example DNS NS";
        await monitorForm.fillMonitorDetails(friendlyName, "example.com");
        await monitorForm.selectResolveType("NS");

        // Add Conditions & fill values
        await monitorForm.addCondition();
        await monitorForm.verifyConditionCount(2); // 1 added by default + 1 explicitly added
        await monitorForm.setConditionValues([
            "a.iana-servers.net",
            "b.iana-servers.net",
        ]);

        await screenshot(testInfo, page);
        await monitorForm.saveMonitor();
        await monitorForm.verifyMonitorStatus("up");

        await screenshot(testInfo, page);
    });

    test("failing condition", async ({ page }, testInfo) => {
        await monitorForm.navigateToAddPage();
        await monitorForm.login(testInfo);

        await monitorForm.selectMonitorType("dns");

        const friendlyName = "Example DNS NS";
        await monitorForm.fillMonitorDetails(friendlyName, "example.com");
        await monitorForm.selectResolveType("NS");

        // Verify initial condition
        await monitorForm.verifyConditionCount(1); // 1 added by default
        await monitorForm.setConditionValues(["definitely-not.net"]);

        await screenshot(testInfo, page);
        await monitorForm.saveMonitor();
        await monitorForm.verifyMonitorStatus("down");

        await screenshot(testInfo, page);
    });
});
