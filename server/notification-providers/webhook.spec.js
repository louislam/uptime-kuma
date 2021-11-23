jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const Webhook = require("./webhook");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Webhook();
        expect(notification.name).toBe("webhook");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data as not form-data", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Webhook();
        let notificationConf = {
            type: "webhook",
            webhookURL: "abc.com/webhook",
            webhookContentType: "JSON"
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

        expect(axios.post).toHaveBeenCalledWith("abc.com/webhook", {
            "heartbeat": {
                "msg": "heart beating",
                "status": 0,
            },
            "monitor": {
                "hostname": "abc.com",
                "name": "name",
                "port": "1234",
                "type": "port",
                "url": "https://www.abc.com",
            },
            "msg": "PassedInMessage😀",
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

    //TODO finish headers test.
    // it("should call axios with the proper default data as form-data", async () => {

    //     let response = {
    //         data: {
    //             Message: "OK"
    //         }
    //     };
    //     axios.post.mockResolvedValueOnce(response);

    //     let notif = new Webhook();
    //     let notificationConf = {
    //         type: "webhook",
    //         webhookURL: "abc.com/webhook",
    //         webhookContentType: "form-data"
    //     };
    //     let monitorConf = {
    //         type: "port",
    //         hostname: "abc.com",
    //         port: "1234",
    //         url: "https://www.abc.com",
    //         name: "name",
    //     };
    //     let heartbeatConf = {
    //         status: DOWN,
    //         msg: "heart beating"
    //     };
    //     let msg = "PassedInMessage😀";
    //     let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

    //     expect(axios.post).toHaveBeenCalledWith("abc.com/webhook", {}, {
    //         "headers": {
    //             "content-type": "multipart/form-data; boundary=--------------------------219451039202311711580332",
    //         },
    //     });
    //     expect(res).toBe("Sent Successfully.");
    // });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Webhook();
        let notificationConf = {
            type: "webhook",
            webhookURL: "abc.com/webhook"
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("abc.com/webhook", {
            "heartbeat": null,
            "monitor": null,

            "msg": "PassedInMessage😀",
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Webhook();
        let notificationConf = {
            type: "webhook",
            webhookURL: "abc.com/webhook"
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("abc.com/webhook", {
            "heartbeat": null,
            "monitor": null,
            "msg": "PassedInMessage😀",
        }, {});
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
            type: "webhook",
            webhookURL: "abc.com/webhook"
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
        expect(axios.post).toHaveBeenCalledWith("abc.com/webhook", {
            "heartbeat": {
                "msg": "heart beating",
                "status": 0,
            },
            "monitor": {
                "hostname": "abc.com",
                "name": "name",
                "port": "1234",
                "type": "port",
                "url": "https://www.abc.com",
            },
            "msg": "PassedInMessage😀",
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

});
