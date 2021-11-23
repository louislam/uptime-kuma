jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Feishu = require("./feishu");

beforeEach(() => {
    axios.post.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Feishu();
        expect(notification.name).toBe("Feishu");
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

        let notif = new Feishu();
        let notificationConf = {
            feishuWebHookUrl: "feishuWebHookUrl"
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

        expect(axios.post).toHaveBeenCalledWith("feishuWebHookUrl", {
            content: {
                post: {
                    zh_cn: {
                        content: [
                            [
                                {
                                    tag: "text",
                                    text: "[Up] some message\nTime (UTC): example time",
                                },
                            ],
                        ],
                        title: "UptimeKuma Alert: testing",
                    },
                },
            },
            msg_type: "post",
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

        let notif = new Feishu();
        let notificationConf = {
            feishuWebHookUrl: "feishuWebHookUrl"
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("feishuWebHookUrl", {
            "content": {
                "text": "PassedInMessage"
            },
            "msg_type": "text"
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
            feishuWebHookUrl: "feishuWebHookUrl"

        };
        let msg = "PassedInMessage";
        let notif = new Feishu();

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("feishuWebHookUrl", {
            content: {
                text: "PassedInMessage",
            },
            msg_type: "text",
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
            type: "Feishu",
            feishuWebHookUrl: "feishuWebHookUrl"
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
        expect(axios.post).toHaveBeenCalledWith("feishuWebHookUrl", {
            content: {
                post: {
                    zh_cn: {
                        content: [
                            [
                                {
                                    tag: "text",
                                    text: "[Up] some message\nTime (UTC): example time",
                                },
                            ],
                        ],
                        title: "UptimeKuma Alert: testing",
                    },
                },
            },
            msg_type: "post",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
