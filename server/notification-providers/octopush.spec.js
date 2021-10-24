jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Octopush = require("./octopush");

beforeEach(() => {
    axios.post.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Octopush();
        expect(notification.name).toBe("octopush");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data when version 2", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Octopush();
        let notificationConf = {
            type: "octopush",
            octopushVersion: 2,
            octopushAPIKey: "key",
            octopushLogin: "login",
            octopushPhoneNumber: "number",
            octopushSMSType: "type",
            octopushSenderName: "sender"
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
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://api.octopush.com/v1/public/sms-campaign/send", {
            "purpose": "alert",
            "recipients": [{ "phone_number": "number" }],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": "type"
        }, {
            "headers": {
                "api-key": "key",
                "api-login": "login",
                "cache-control": "no-cache"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });
    it("should call axios with the proper default data when version 1", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Octopush();
        let notificationConf = {
            type: "octopush",
            octopushVersion: 1,
            octopushDMAPIKey: "key",
            octopushDMLogin: "login",
            octopushDMPhoneNumber: "number",
            octopushDMSMSType: "sms_premium",
            octopushDMSenderName: "sender"
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
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://www.octopush-dm.com/api/sms/json", {

        }, {
            "headers": {
                "cache-control": "no-cache"
            },
            "params": {
                "api_key": "key",
                "sms_recipients": "number",
                "sms_sender": "sender",
                "sms_text": "PassedInMessage",
                "sms_type": "FR",
                "transactional": "1",
                "user_login": "login"
            }
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

        let notif = new Octopush();
        let notificationConf = {
            type: "lunasea",
            lunaseaDevice: "1234",
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("https://api.octopush.com/v1/public/sms-campaign/send", {
            "purpose": "alert",
            "recipients": [{ "phone_number": undefined }],
            "sender": undefined,
            "text": "PassedInMessage",
            "type": undefined
        }, {
            "headers": {
                "api-key": undefined,
                "api-login": undefined,
                "cache-control": "no-cache"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Octopush();
        let notificationConf = {
            type: "octopush",
            octopushVersion: 2,
            octopushAPIKey: "key",
            octopushLogin: "login",
            octopushPhoneNumber: "number",
            octopushSMSType: "type",
            octopushSenderName: "sender"
        };
        let msg = "PassedInMessage";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://api.octopush.com/v1/public/sms-campaign/send", {
            "purpose": "alert",
            "recipients": [{ "phone_number": "number" }],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": "type"
        }, {
            "headers": {
                "api-key": "key",
                "api-login": "login",
                "cache-control": "no-cache"
            }
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
            type: "octopush",
            octopushVersion: 2,
            octopushAPIKey: "key",
            octopushLogin: "login",
            octopushPhoneNumber: "number",
            octopushSMSType: "type",
            octopushSenderName: "sender"
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
        let res = await NotificationSend.Notification.send(notificationConf, "Passed😀InMessage", monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("https://api.octopush.com/v1/public/sms-campaign/send", {
            "purpose": "alert",
            "recipients": [{ "phone_number": "number" }],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": "type"
        }, {
            "headers": {
                "api-key": "key",
                "api-login": "login",
                "cache-control": "no-cache"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });

});
