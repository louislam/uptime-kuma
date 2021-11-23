jest.mock("child_process", () => ({
    spawnSync: jest.fn(),
}));

const childProcess = require("child_process");
const { UP } = require("../../src/util");
const NotificationSend = require("../notification");

const Apprise = require("./apprise");

beforeEach(() => {
    childProcess.spawnSync.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Apprise();
        expect(notification.name).toBe("apprise");
    });
});

describe("notification to act properly on send", () => {
    it("should call apprise with the proper default data", async () => {

        childProcess.spawnSync.mockImplementationOnce(() => {
            return { stdout: "response" };
        });

        let notif = new Apprise();
        let notificationConf = {
            appriseURL: "appriseURL",
        };
        let msg = "PassedInMessage";
        let res = await notif.send(notificationConf, msg, null, null);

        expect(childProcess.spawnSync).toHaveBeenCalledWith("apprise", ["-vv", "-b", "PassedInMessage", "appriseURL"]);
        expect(res).toBe("Sent Successfully.");
    });

    //TODO code under test unreachable. Remove or resolve.
    // it("should call output no data when no data", async () => {

    //     childProcess.spawnSync.mockImplementationOnce(() => {
    //         return { stdout: "" };
    //     });

    //     let notif = new Apprise();
    //     let notificationConf = {
    //         appriseURL: "appriseURL",
    //     };
    //     let msg = "PassedInMessage";
    //     let res = await notif.send(notificationConf, msg, null, null);

    //     expect(childProcess.spawnSync).toHaveBeenCalledWith("apprise", ["-vv", "-b", "PassedInMessage", "appriseURL"]);
    //     expect(res).toBe("No output from apprise");
    // });

});

describe("notification to act properly on errors from apprise", () => {
    it("should call apprise with the proper default data", async () => {

        childProcess.spawnSync.mockImplementationOnce(() => {
            return { stdout: "ERROR FROM APPRISE" };
        });

        let notif = new Apprise();
        let notificationConf = {
            appriseURL: "appriseURL",
        };
        let msg = "PassedInMessage";
        try {
            await notif.send(notificationConf, msg, null, null);
            expect("not reached").toBe(false);
        } catch (e) {
            expect(e.message).toBe("ERROR FROM APPRISE");
        }

        expect(childProcess.spawnSync).toHaveBeenCalledWith("apprise", ["-vv", "-b", "PassedInMessage", "appriseURL"]);
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call sendMail with proper data", async () => {
        childProcess.spawnSync.mockImplementationOnce(() => {
            return { stdout: "response" };
        });

        let notificationConf = {
            type: "apprise",
            appriseURL: "appriseURL",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);

        expect(res).toBe("Sent Successfully.");

        expect(childProcess.spawnSync).toHaveBeenCalledWith("apprise", ["-vv", "-b", "PassedInMessage", "appriseURL"]);
        expect(res).toBe("Sent Successfully.");
    });

});
