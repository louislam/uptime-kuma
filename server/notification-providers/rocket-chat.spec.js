jest.mock("axios", () => ({
    post: jest.fn(),
}));

jest.mock("../util-server");

const axios = require("axios");
const { setting } = require("../util-server");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
    setting.mockReset();
});
const RocketChat = require("./rocket-chat");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new RocketChat();
        expect(notification.name).toBe("rocket.chat");
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
        setting.mockResolvedValueOnce("base.com");
        let notif = new RocketChat();
        let notificationConf = {
            rocketchannel: "channel",
            rocketusername: "user",
            rocketiconemo: "😀",
            rocketwebhookURL: "example.com",
        };
        let monitorConf = {
            id: "123"
        };
        let heartbeatConf = {
            status: UP,
            time: "some time"
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("example.com", {
            "attachments": [
                {
                    "color": "#32cd32",
                    "text": "*Message*\nPassedInMessage😀",
                    "title": "Uptime Kuma Alert *Time (UTC)*\nsome time",
                    "title_link": "base.com/dashboard/123",
                },
            ],
            "channel": "channel",
            "icon_emoji": "😀",
            "text": "Uptime Kuma Alert",
            "username": "user",
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper default data when DOWN", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        setting.mockResolvedValueOnce("base.com");
        axios.post.mockResolvedValueOnce(response);

        let notif = new RocketChat();
        let notificationConf = {
            rocketchannel: "channel",
            rocketusername: "user",
            rocketiconemo: "😀",
            rocketwebhookURL: "example.com",
        };
        let monitorConf = {
            id: "123"
        };
        let heartbeatConf = {
            status: DOWN,
            time: "some time"
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("example.com", {
            "attachments": [
                {
                    "color": "#ff0000",
                    "text": "*Message*\nPassedInMessage😀",
                    "title": "Uptime Kuma Alert *Time (UTC)*\nsome time",
                    "title_link": "base.com/dashboard/123",
                },
            ],
            "channel": "channel",
            "icon_emoji": "😀",
            "text": "Uptime Kuma Alert",
            "username": "user",
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        setting.mockResolvedValueOnce("base.com");
        axios.post.mockResolvedValueOnce(response);

        let notif = new RocketChat();
        let notificationConf = {
            rocketchannel: "channel",
            rocketusername: "user",
            rocketiconemo: "😀",
            rocketwebhookURL: "example.com",
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("example.com", {
            "channel": "channel",
            "icon_emoji": "😀",
            "text": "PassedInMessage😀",
            "username": "user",
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        setting.mockResolvedValueOnce("base.com");
        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new RocketChat();
        let notificationConf = {
            rocketchannel: "channel",
            rocketusername: "user",
            rocketiconemo: "😀",
            rocketwebhookURL: "example.com",
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("example.com", {
            "channel": "channel",
            "icon_emoji": "😀",
            "text": "PassedInMessage😀",
            "username": "user",
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
        setting.mockResolvedValueOnce("base.com");
        axios.post.mockResolvedValueOnce(response);
        let notificationConf = {
            type: "rocket.chat",
            rocketchannel: "channel",
            rocketusername: "user",
            rocketiconemo: "😀",
            rocketwebhookURL: "example.com",
        };
        let monitorConf = {
            id: "123"
        };
        let heartbeatConf = {
            status: UP,
            time: "some time"
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("example.com", {
            "attachments": [
                {
                    "color": "#32cd32",
                    "text": "*Message*\nPassedInMessage😀",
                    "title": "Uptime Kuma Alert *Time (UTC)*\nsome time",
                    "title_link": "base.com/dashboard/123",
                },
            ],
            "channel": "channel",
            "icon_emoji": "😀",
            "text": "Uptime Kuma Alert",
            "username": "user",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
