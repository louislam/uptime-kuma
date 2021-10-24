jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Mattermost = require("./mattermost");

beforeEach(() => {
    axios.post.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Mattermost();
        expect(notification.name).toBe("mattermost");
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

        let notif = new Mattermost();
        let notificationConf = {
            type: "mattermost",
            mattermostchannel: "1234",
            mattermosticonemo: "😀",
            mattermosticonurl: "www.testing.com",
            mattermostWebhookUrl: "www.example.com/webhook",
            mattermostusername: "username",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            ping: "123",
            time: "example time",
        };
        let msg = "PassedInMessage";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("www.example.com/webhook", {
            "attachments": [
                {
                    "color": "#32CD32",
                    "fallback": "Your testing service went up!",
                    "fields": [
                        {
                            "short": true,
                            "title": "Service Name",
                            "value": "testing",
                        },
                        {
                            "short": true,
                            "title": "Time (UTC)",
                            "value": "example time",
                        },
                        {
                            "short": false,
                            "title": "Ping",
                            "value": "123ms",
                        },
                    ],
                    "title": "✅ testing service went up! ✅",
                    "title_link": "https://www.google.com",
                },
            ],
            "channel": "1234",
            "icon_emoji": "😀",
            "icon_url": "www.testing.com",
            "text": "Uptime Kuma Alert",
            "username": "username",
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

        let notif = new Mattermost();
        let notificationConf = {
            type: "mattermost",
            mattermostchannel: "1234",
            mattermosticonemo: "😀",
            mattermosticonurl: "www.testing.com",
            mattermostWebhookUrl: "www.example.com/webhook",
            mattermostusername: "username",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: DOWN,
            msg: "some message",
            ping: "123",
            time: "example time",
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("www.example.com/webhook", {
            "attachments": [
                {
                    "color": "#FF0000",
                    "fallback": "Your testing service went down!",
                    "fields": [
                        {
                            "short": true,
                            "title": "Service Name",
                            "value": "testing",
                        },
                        {
                            "short": true,
                            "title": "Time (UTC)",
                            "value": "example time",
                        },
                        {
                            "short": false,
                            "title": "Error",
                            "value": "some message",
                        },
                    ],
                    "title": "❌ testing service went down! ❌",
                    "title_link": "https://www.google.com",
                },
            ],
            "channel": "1234",
            "icon_emoji": "😀",
            "icon_url": "www.testing.com",
            "text": "Uptime Kuma Alert",
            "username": "username",
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

        let notif = new Mattermost();
        let notificationConf = {
            type: "mattermost",
            mattermostchannel: "1234",
            mattermosticonemo: "😀",
            mattermosticonurl: "www.testing.com",
            mattermostWebhookUrl: "www.example.com/webhook",
            mattermostusername: "username",
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("www.example.com/webhook", {

            "text": "PassedInMessage",
            "username": "username"
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Mattermost();
        let notificationConf = {
            type: "mattermost",
            mattermostchannel: "1234",
            mattermosticonemo: "😀",
            mattermosticonurl: "www.testing.com",
            mattermostWebhookUrl: "www.example.com/webhook",
            mattermostusername: "username",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            ping: "123",
            time: "example time",
        };
        let msg = "PassedInMessage";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("www.example.com/webhook", {

            "text": "PassedInMessage",
            "username": "username"
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
            type: "mattermost",
            mattermostchannel: "1234",
            mattermosticonemo: "😀",
            mattermosticonurl: "www.testing.com",
            mattermostWebhookUrl: "www.example.com/webhook",
            mattermostusername: "username",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            ping: "123",
            time: "example time",
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("www.example.com/webhook", {
            "attachments": [
                {
                    "color": "#32CD32",
                    "fallback": "Your testing service went up!",
                    "fields": [
                        {
                            "short": true,
                            "title": "Service Name",
                            "value": "testing",
                        },
                        {
                            "short": true,
                            "title": "Time (UTC)",
                            "value": "example time",
                        },
                        {
                            "short": false,
                            "title": "Ping",
                            "value": "123ms",
                        },
                    ],
                    "title": "✅ testing service went up! ✅",
                    "title_link": "https://www.google.com",
                },
            ],
            "channel": "1234",
            "icon_emoji": "😀",
            "icon_url": "www.testing.com",
            "text": "Uptime Kuma Alert",
            "username": "username",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
