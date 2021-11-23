jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const Signal = require("./signal");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Signal();
        expect(notification.name).toBe("signal");
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

        let notif = new Signal();
        let notificationConf = {
            type: "signal",
            signalNumber: "appriseURL",
            signalRecipients: "asd asd, age, ge, wrh werh ,werh ,er h,as",
            signalURL: "https://example.com/webhook",
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.post).toHaveBeenCalledWith("https://example.com/webhook", {
            "message": "PassedInMessage😀",
            "number": "appriseURL",
            "recipients": [
                "asdasd",
                "age",
                "ge",
                "wrhwerh",
                "werh",
                "erh",
                "as",
            ],
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.post.mockResolvedValueOnce(response);

        let notif = new Signal();
        let notificationConf = {
            type: "signal",
            signalNumber: "appriseURL",
            signalRecipients: "asd asd, age, ge, wrh werh ,werh ,er h,as",
            signalURL: "https://example.com/webhook",
        };
        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.post).toHaveBeenCalledWith("https://example.com/webhook", {
            "message": "PassedInMessage😀",
            "number": "appriseURL",
            "recipients": [
                "asdasd",
                "age",
                "ge",
                "wrhwerh",
                "werh",
                "erh",
                "as",
            ],
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.post.mockImplementation(() => {
            throw new Error("Test Error");
        });
        let notif = new Signal();
        let notificationConf = {
            type: "signal",
            signalNumber: "appriseURL",
            signalRecipients: "asd asd, age, ge, wrh werh ,werh ,er h,as",
            signalURL: "https://example.com/webhook",
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.post).toHaveBeenCalledWith("https://example.com/webhook", {
            "message": "PassedInMessage😀",
            "number": "appriseURL",
            "recipients": [
                "asdasd",
                "age",
                "ge",
                "wrhwerh",
                "werh",
                "erh",
                "as",
            ],
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
            type: "signal",
            signalNumber: "appriseURL",
            signalRecipients: "asd asd, age, ge, wrh werh ,werh ,er h,as",
            signalURL: "https://example.com/webhook",
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.post).toHaveBeenCalledWith("https://example.com/webhook", {
            "message": "PassedInMessage😀",
            "number": "appriseURL",
            "recipients": [
                "asdasd",
                "age",
                "ge",
                "wrhwerh",
                "werh",
                "erh",
                "as",
            ],
        }, {});
        expect(res).toBe("Sent Successfully.");
    });

});
