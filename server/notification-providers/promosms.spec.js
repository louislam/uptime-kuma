jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const PromoSMS = require("./promosms");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new PromoSMS();
        expect(notification.name).toBe("promosms");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        let response = {
            data: {
                response: {
                    status: 0
                },
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new PromoSMS();
        let notificationConf = {
            type: "promosms",
            promosmsLogin: "login",
            promosmsPassword: "password",
            promosmsPhoneNumber: "number",
            promosmsSMSType: 1,
            promosmsSenderName: "sender"
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://promosms.com/api/rest/v3_2/sms", {
            "recipients": [
                "number",
            ],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": 1,
        }, {
            "headers": {
                "Accept": "text/json",
                "Authorization": "Basic bG9naW46cGFzc3dvcmQ=",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                response: {
                    status: 0
                },
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new PromoSMS();
        let notificationConf = {
            type: "promosms",
            promosmsLogin: "login",
            promosmsPassword: "password",
            promosmsPhoneNumber: "number",
            promosmsSMSType: 1,
            promosmsSenderName: "sender"
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("https://promosms.com/api/rest/v3_2/sms", {
            "recipients": [
                "number",
            ],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": 1,
        }, {
            "headers": {
                "Accept": "text/json",
                "Authorization": "Basic bG9naW46cGFzc3dvcmQ=",
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
        let notif = new PromoSMS();
        let notificationConf = {
            type: "promosms",
            promosmsLogin: "login",
            promosmsPassword: "password",
            promosmsPhoneNumber: "number",
            promosmsSMSType: 1,
            promosmsSenderName: "sender"
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://promosms.com/api/rest/v3_2/sms", {
            "recipients": [
                "number",
            ],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": 1,
        }, {
            "headers": {
                "Accept": "text/json",
                "Authorization": "Basic bG9naW46cGFzc3dvcmQ=",
                "Content-Type": "application/json",
            },
        });
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call axios with proper data", async () => {
        let response = {
            data: {
                response: {
                    status: 0
                },
            }
        };
        axios.post.mockResolvedValueOnce(response);
        let notificationConf = {
            type: "promosms",
            promosmsLogin: "login",
            promosmsPassword: "password",
            promosmsPhoneNumber: "number",
            promosmsSMSType: 1,
            promosmsSenderName: "sender"
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("https://promosms.com/api/rest/v3_2/sms", {
            "recipients": [
                "number",
            ],
            "sender": "sender",
            "text": "PassedInMessage",
            "type": 1,
        }, {
            "headers": {
                "Accept": "text/json",
                "Authorization": "Basic bG9naW46cGFzc3dvcmQ=",
                "Content-Type": "application/json",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

});
