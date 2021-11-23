jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Discord = require("./discord");

beforeEach(() => {
    axios.post.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Discord();
        expect(notification.name).toBe("discord");
    });
});

describe("notification to act properly on send", () => {

    it("should call axios with the proper data when missing heartbeat/monitor", async () => {

        let response = {};
        axios.post.mockResolvedValueOnce(response);

        let notif = new Discord();
        let url = "https://example.com/webhook";
        let notificationConf = {
            discordUsername: "username",
            discordWebhookUrl: url,
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith(url, {
            content: "PassedInMessage",
            username: "username"
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when having heartbeat & monitor & service up", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementationOnce(() =>
                new Date("2019-05-14T11:01:58.135Z").valueOf()
            );

        let response = {};
        axios.post.mockResolvedValueOnce(response);

        let notif = new Discord();
        let url = "https://example.com/webhook";
        let notificationConf = {
            discordUsername: "username",
            discordWebhookUrl: url,
            discordPrefixMessage: "prefix",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing monitor",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
            ping: "111"
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith(url, {
            content: "prefix",
            embeds: [
                {
                    color: 65280,
                    fields: [
                        {
                            name: "Service Name",
                            value: "testing monitor",
                        },
                        {
                            name: "Service URL",
                            value: "[Visit Service](https://www.google.com)",
                        },
                        {
                            name: "Time (UTC)",
                            value: "example time",
                        },
                        {
                            name: "Ping",
                            value: "111ms",
                        },
                    ],
                    timestamp: "example time",
                    title: "✅ Your service testing monitor is up! ✅",
                },
            ],
            username: "username"
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when having heartbeat & monitor & service down", async () => {

        let response = {};
        axios.post.mockResolvedValueOnce(response);

        let notif = new Discord();
        let url = "https://example.com/webhook";
        let notificationConf = {
            discordUsername: "username",
            discordWebhookUrl: url,
            discordPrefixMessage: "prefix",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing monitor",
        };
        let heartbeatConf = {
            status: DOWN,
            msg: "some message",
            time: "example time",
            ping: "111"
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith(url, {
            content: "prefix",
            embeds: [
                {
                    color: 16711680,
                    fields: [
                        {
                            name: "Service Name",
                            value: "testing monitor",
                        },
                        {
                            name: "Service URL",
                            value: "[Visit Service](https://www.google.com)",
                        },
                        {
                            name: "Time (UTC)",
                            value: "example time",
                        },
                        {
                            name: "Error",
                            value: "some message",
                        },
                    ],
                    timestamp: "example time",
                    title: "❌ Your service testing monitor went down. ❌",
                },
            ],
            username: "username"
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });

        let notif = new Discord();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            discordWebhookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";

        try {
            await notif.send(notificationConf, msg, null, null);
            console.log("fail");
            expect("Error thrown").toBe(false);
        } catch (e) {
            //axios general error on catching another error is not the cleanest, but works.
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://example.com/webhook", {
            content: "PassedInMessage",
            username: "Uptime Kuma"
        });
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call sendMail with proper data", async () => {

        let response = {};
        axios.post.mockResolvedValueOnce(response);

        let url = "https://example.com/webhook";
        let notificationConf = {
            type: "discord",
            discordUsername: "username",
            discordWebhookUrl: url,
            discordPrefixMessage: "prefix",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing monitor",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
            ping: "111"
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith(url, {
            content: "prefix",
            embeds: [
                {
                    color: 65280,
                    fields: [
                        {
                            name: "Service Name",
                            value: "testing monitor",
                        },
                        {
                            name: "Service URL",
                            value: "[Visit Service](https://www.google.com)",
                        },
                        {
                            name: "Time (UTC)",
                            value: "example time",
                        },
                        {
                            name: "Ping",
                            value: "111ms",
                        },
                    ],
                    timestamp: "example time",
                    title: "✅ Your service testing monitor is up! ✅",
                },
            ],
            username: "username"
        });
        expect(res).toBe("Sent Successfully.");
    });

});
