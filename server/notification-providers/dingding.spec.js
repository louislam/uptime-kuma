jest.mock("axios");

const { UP } = require("../../src/util");
const NotificationSend = require("../notification");

const DingDing = require("./dingding");

const axios = require("axios");

beforeEach(() => {
    axios.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new DingDing();
        expect(notification.name).toBe("DingDing");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementationOnce(() =>
                new Date("2019-05-14T11:01:58.135Z").valueOf()
            );

        let response = {
            data: {
                errmsg: "ok"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new DingDing();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios).toHaveBeenCalledWith({
            data: "{\"msgtype\":\"markdown\",\"markdown\":{\"title\":\"testing\",\"text\":\"## [UP] testing\\n > some message  \\n > Time(UTC):example time\"}}",
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            url: "https://example.com/webhook&timestamp=1557831718135&sign=lCTIn3sYpAYFAw3B2LeTLr7BvcOMAcmZu%2F6rb7kC8Io%3D",
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when missing heartbeat", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementationOnce(() =>
                new Date("2019-05-14T11:01:58.135Z").valueOf()
            );

        let response = {
            data: {
                errmsg: "ok"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new DingDing();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let res = await notif.send(notificationConf, msg, monitorConf, null);

        expect(axios).toHaveBeenCalledWith({
            data: "{\"msgtype\":\"text\",\"text\":{\"content\":\"PassedInMessage\"}}",
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            url: "https://example.com/webhook&timestamp=1557831718135&sign=lCTIn3sYpAYFAw3B2LeTLr7BvcOMAcmZu%2F6rb7kC8Io%3D",
        });
        expect(res).toBe("Sent Successfully.");
    });

    //TODO need to get correct response when sendToDingDing fails, but no axios error.

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementationOnce(() =>
                new Date("2019-05-14T11:01:58.135Z").valueOf()
            );

        axios.mockImplementationOnce(() => {
            throw new Error("Test Error");
        });

        let notif = new DingDing();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
        };

        try {
            await notif.send(notificationConf, msg, monitorConf, heartbeatConf);
            console.log("fail");
            expect("Error thrown").toBe(false);
        } catch (e) {
            //axios general error on catching another error is not the cleanest, but works.
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios).toHaveBeenCalledWith({
            data: "{\"msgtype\":\"markdown\",\"markdown\":{\"title\":\"testing\",\"text\":\"## [UP] testing\\n > some message  \\n > Time(UTC):example time\"}}",
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            url: "https://example.com/webhook&timestamp=1557831718135&sign=lCTIn3sYpAYFAw3B2LeTLr7BvcOMAcmZu%2F6rb7kC8Io%3D",
        });
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call sendMail with proper data", async () => {
        jest.spyOn(global.Date, "now")
            .mockImplementationOnce(() =>
                new Date("2019-05-14T11:01:58.135Z").valueOf()
            );

        let response = {
            data: {
                errmsg: "ok"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new DingDing();
        let notificationConf = {
            type: "DingDing",
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
        };
        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);

        expect(res).toBe("Sent Successfully.");

        expect(axios).toHaveBeenCalledWith({
            data: "{\"msgtype\":\"markdown\",\"markdown\":{\"title\":\"testing\",\"text\":\"## [UP] testing\\n > some message  \\n > Time(UTC):example time\"}}",
            headers: {
                "Content-Type": "application/json",
            },
            method: "POST",
            url: "https://example.com/webhook&timestamp=1557831718135&sign=lCTIn3sYpAYFAw3B2LeTLr7BvcOMAcmZu%2F6rb7kC8Io%3D",

        });
        expect(res).toBe("Sent Successfully.");
    });

});
