jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Line = require("./line");

beforeEach(() => {
    axios.post.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Line();
        expect(notification.name).toBe("line");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data when UP", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Line();
        let notificationConf = {
            type: "line",
            lineUserID: "1234",
            lineChannelAccessToken: "token"
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

        expect(axios.post).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
            messages: [
                {
                    text: "UptimeKuma Alert: [✅ Up]\nName: testing\nsome message\nTime (UTC): example time",
                    type: "text",
                },
            ],
            to: "1234",
        }, {
            headers: {
                "Authorization": "Bearer token",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });
    it("should call axios with the proper default data when DOWN", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Line();
        let notificationConf = {
            type: "line",
            lineUserID: "1234",
            lineChannelAccessToken: "token"
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: DOWN,
            msg: "some message",
            time: "example time",
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
            messages: [
                {
                    text: "UptimeKuma Alert: [🔴 Down]\nName: testing\nsome message\nTime (UTC): example time",
                    type: "text",
                },
            ],
            to: "1234",
        }, {
            headers: {
                "Authorization": "Bearer token",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Line();
        let notificationConf = {
            type: "line",
            lineUserID: "1234",
            lineChannelAccessToken: "token"
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
            messages: [
                {
                    text: "Test Successful!",
                    type: "text",
                },
            ],
            to: "1234",
        }, {
            headers: {
                "Authorization": "Bearer token",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });

        let notificationConf = {
            type: "line",
            lineUserID: "1234",
            lineChannelAccessToken: "token"
        };
        let msg = "PassedInMessage";
        let notif = new Line();

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
            messages: [
                {
                    text: "Test Successful!",
                    type: "text",
                },
            ],
            to: "1234",
        }, {
            headers: {
                "Authorization": "Bearer token",
                "Content-Type": "application/json",
            },
        });
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call axios with proper data", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);
        let notificationConf = {
            type: "line",
            lineUserID: "1234",
            lineChannelAccessToken: "token"
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
        expect(axios.post).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/push", {
            messages: [
                {
                    text: "UptimeKuma Alert: [✅ Up]\nName: testing\nsome message\nTime (UTC): example time",
                    type: "text",
                },
            ],
            to: "1234",
        }, {
            headers: {
                "Authorization": "Bearer token",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

});
