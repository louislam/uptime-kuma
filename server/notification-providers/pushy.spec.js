jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const Pushy = require("./pushy");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Pushy();
        expect(notification.name).toBe("pushy");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Pushy();
        let notificationConf = {
            pushyAPIKey: "key",
            pushyToken: "token"
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://api.pushy.me/push?api_key=key", {
            "data": {
                "message": "Uptime-Kuma",
            },
            "notification": {
                "badge": 1,
                "body": "PassedInMessage😀",
                "sound": "ping.aiff",
            },
            "to": "token",
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

        let notif = new Pushy();
        let notificationConf = {
            pushyAPIKey: "key",
            pushyToken: "token"
        };

        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("https://api.pushy.me/push?api_key=key", {
            "data": {
                "message": "Uptime-Kuma",
            },
            "notification": {
                "badge": 1,
                "body": "PassedInMessage😀",
                "sound": "ping.aiff",
            },
            "to": "token",
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Pushy();
        let notificationConf = {
            pushyAPIKey: "key",
            pushyToken: "token"
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://api.pushy.me/push?api_key=key", {
            "data": {
                "message": "Uptime-Kuma",
            },
            "notification": {
                "badge": 1,
                "body": "PassedInMessage😀",
                "sound": "ping.aiff",
            },
            "to": "token",
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
            type: "pushy",
            pushyAPIKey: "key",
            pushyToken: "token"
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("https://api.pushy.me/push?api_key=key", {
            "data": {
                "message": "Uptime-Kuma",
            },
            "notification": {
                "badge": 1,
                "body": "PassedInMessage😀",
                "sound": "ping.aiff",
            },
            "to": "token",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
