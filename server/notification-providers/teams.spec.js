jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const Teams = require("./teams");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Teams();
        expect(notification.name).toBe("teams");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data when up", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Teams();
        let notificationConf = {
            webhookUrl: "teams.com/webhook"
        };
        let monitorConf = {
            type: "port",
            hostname: "abc.com",
            port: "1234",
            url: "https://www.abc.com",
            name: "name",
        };
        let heartbeatConf = {
            status: UP,
            msg: "heart beating"
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("teams.com/webhook", {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            "sections": [
                {
                    "activityImage": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    "activityTitle": "**Uptime Kuma**",
                },
                {
                    "activityTitle": "✅ Application [name] is back online",
                },
                {
                    "activityTitle": "**Description**",
                    "facts": [
                        {
                            "name": "Monitor",
                            "value": "name"
                        },
                        {
                            "name": "URL",
                            "value": "abc.com:1234",
                        },
                    ],
                    "text": "heart beating",
                },
            ],
            "summary": "✅ Application [name] is back online",
            "themeColor": "00e804",
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

        let notif = new Teams();
        let notificationConf = {
            webhookUrl: "teams.com/webhook"
        };
        let monitorConf = {
            type: "port",
            hostname: "abc.com",
            port: "1234",
            url: "https://www.abc.com",
            name: "name",
        };
        let heartbeatConf = {
            status: DOWN,
            msg: "heart beating"
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("teams.com/webhook", {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            "sections": [
                {
                    "activityImage": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    "activityTitle": "**Uptime Kuma**",
                },
                {
                    "activityTitle": "🔴 Application [name] went down",
                },
                {
                    "activityTitle": "**Description**",
                    "facts": [
                        {
                            "name": "Monitor",
                            "value": "name"
                        },
                        {
                            "name": "URL",
                            "value": "abc.com:1234",
                        },
                    ],
                    "text": "heart beating",
                },
            ],
            "summary": "🔴 Application [name] went down",
            "themeColor": "ff0000",
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

        let notif = new Teams();
        let notificationConf = {
            webhookUrl: "teams.com/webhook"
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("teams.com/webhook", {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            "sections": [
                {
                    "activityImage": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    "activityTitle": "**Uptime Kuma**",
                },
                {
                    "activityTitle": "Notification",
                },
                {
                    "activityTitle": "**Description**",
                    "facts": [ ],
                    "text": "PassedInMessage😀",
                },
            ],
            "summary": "Notification",
            "themeColor": "008cff",
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Teams();
        let notificationConf = {
            webhookUrl: "teams.com/webhook"
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("teams.com/webhook", {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            "sections": [
                {
                    "activityImage": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    "activityTitle": "**Uptime Kuma**",
                },
                {
                    "activityTitle": "Notification",
                },
                {
                    "activityTitle": "**Description**",
                    "facts": [ ],
                    "text": "PassedInMessage😀",
                },
            ],
            "summary": "Notification",
            "themeColor": "008cff",
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
            type: "teams",
            webhookUrl: "teams.com/webhook"
        };
        let monitorConf = {
            type: "port",
            hostname: "abc.com",
            port: "1234",
            url: "https://www.abc.com",
            name: "name",
        };
        let heartbeatConf = {
            status: DOWN,
            msg: "heart beating"
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("teams.com/webhook", {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            "sections": [
                {
                    "activityImage": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    "activityTitle": "**Uptime Kuma**",
                },
                {
                    "activityTitle": "🔴 Application [name] went down",
                },
                {
                    "activityTitle": "**Description**",
                    "facts": [
                        {
                            "name": "Monitor",
                            "value": "name"
                        },
                        {
                            "name": "URL",
                            "value": "abc.com:1234",
                        },
                    ],
                    "text": "heart beating",
                },
            ],
            "summary": "🔴 Application [name] went down",
            "themeColor": "ff0000",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
