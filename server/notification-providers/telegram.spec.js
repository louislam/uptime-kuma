jest.mock("axios", () => ({
    get: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.get.mockReset();
});
const Telegram = require("./telegram");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Telegram();
        expect(notification.name).toBe("telegram");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.get.mockResolvedValueOnce(response);

        let notif = new Telegram();
        let notificationConf = {
            type: "telegram",
            telegramBotToken: "abc",
            telegramChatID: "123",

        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.get).toHaveBeenCalledWith("https://api.telegram.org/botabc/sendMessage", {
            "params": {
                "chat_id": "123",
                "text": "PassedInMessage😀",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.get.mockResolvedValueOnce(response);

        let notif = new Telegram();
        let notificationConf = {
            type: "telegram",
            telegramBotToken: "abc",
            telegramChatID: "123",

        };

        let msg = "PassedInMessage😀";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.get).toHaveBeenCalledWith("https://api.telegram.org/botabc/sendMessage", {
            "params": {
                "chat_id": "123",
                "text": "PassedInMessage😀",
            },
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.get.mockImplementation(() => {
            throw {
                response: {
                    data: {
                        description: "Error Description"
                    }
                }
            };
        });
        let notif = new Telegram();
        let notificationConf = {
            type: "telegram",
            telegramBotToken: "abc",
            telegramChatID: "123",
        };
        let msg = "PassedInMessage😀";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error Description");
        }

        expect(axios.get).toHaveBeenCalledWith("https://api.telegram.org/botabc/sendMessage", {
            "params": {
                "chat_id": "123",
                "text": "PassedInMessage😀",
            },
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
        axios.get.mockResolvedValueOnce(response);
        let notificationConf = {
            type: "telegram",
            telegramBotToken: "abc",
            telegramChatID: "123",

        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage😀";

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
        expect(axios.get).toHaveBeenCalledWith("https://api.telegram.org/botabc/sendMessage", {

            "params": {
                "chat_id": "123",
                "text": "PassedInMessage😀",
            },

        });
        expect(res).toBe("Sent Successfully.");
    });

});
