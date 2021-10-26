jest.mock("axios", () => ({
    post: jest.fn(),
}));

jest.mock("../util-server");
const { setting } = require("../util-server");

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    setting.mockReset();
    axios.post.mockReset();
});
const Slack = require("./slack");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Slack();
        expect(notification.name).toBe("slack");
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
        setting.mockResolvedValueOnce("base.com");

        let notif = new Slack();

        let notificationConf = {
            type: "slack",
            slackchannel: "chan",
            slackusername: "name",
            slackiconemo: "😀",
            slackwebhookURL: "www.slack.com/webhook"
        };
        let monitorConf = {
            name: "testing monitor",
            id: "123",
        };
        let heartbeatConf = {
            time: "test time"
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("www.slack.com/webhook", {

            "blocks": [
                {
                    "text": {
                        "text": "Uptime Kuma Alert",
                        "type": "plain_text",
                    },
                    "type": "header",
                },
                {
                    "fields": [
                        {
                            "text": "*Message*\nPassedInMessage😀",
                            "type": "mrkdwn",
                        },
                        {
                            "text": "*Time (UTC)*\ntest time",
                            "type": "mrkdwn",
                        },
                    ],
                    "type": "section",
                },
                {
                    "elements": [
                        {
                            "text": {
                                "text": "Visit Uptime Kuma",
                                "type": "plain_text",
                            },
                            "type": "button",
                            "url": "base.com/dashboard/123",
                            "value": "Uptime-Kuma",
                        },
                    ],
                    "type": "actions",
                },
            ],
            "channel": "chan",
            "icon_emoji": "😀",
            "text": "Uptime Kuma Alert: testing monitor",
            "username": "name",
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
        setting.mockResolvedValueOnce("base.com");

        let notif = new Slack();

        let notificationConf = {
            type: "slack",
            slackchannel: "chan",
            slackusername: "name",
            slackiconemo: "😀",
            slackwebhookURL: "www.slack.com/webhook"
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("www.slack.com/webhook", {

            "channel": "chan",
            "icon_emoji": "😀",
            "text": "PassedInMessage😀",
            "username": "name",
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
        let notif = new Slack();

        let notificationConf = {
            type: "slack",
            slackchannel: "chan",
            slackusername: "name",
            slackiconemo: "😀",
            slackwebhookURL: "www.slack.com/webhook"
        };
        let monitorConf = {
            name: "testing monitor",
            id: "123",
        };
        let heartbeatConf = {
            time: "test time"
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("www.slack.com/webhook", {

            "channel": "chan",
            "icon_emoji": "😀",
            "text": "PassedInMessage😀",
            "username": "name",
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
        setting.mockResolvedValueOnce("base.com");

        let notificationConf = {
            type: "slack",
            slackchannel: "chan",
            slackusername: "name",
            slackiconemo: "😀",
            slackwebhookURL: "www.slack.com/webhook"
        };
        let monitorConf = {
            name: "testing monitor",
            id: "123",
        };
        let heartbeatConf = {
            time: "test time"
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("www.slack.com/webhook", {

            "blocks": [
                {
                    "text": {
                        "text": "Uptime Kuma Alert",
                        "type": "plain_text",
                    },
                    "type": "header",
                },
                {
                    "fields": [
                        {
                            "text": "*Message*\nPassedInMessage😀",
                            "type": "mrkdwn",
                        },
                        {
                            "text": "*Time (UTC)*\ntest time",
                            "type": "mrkdwn",
                        },
                    ],
                    "type": "section",
                },
                {
                    "elements": [
                        {
                            "text": {
                                "text": "Visit Uptime Kuma",
                                "type": "plain_text",
                            },
                            "type": "button",
                            "url": "base.com/dashboard/123",
                            "value": "Uptime-Kuma",
                        },
                    ],
                    "type": "actions",
                },
            ],
            "channel": "chan",
            "icon_emoji": "😀",
            "text": "Uptime Kuma Alert: testing monitor",
            "username": "name",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
