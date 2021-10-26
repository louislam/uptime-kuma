// jest.mock("nodemailer", () => ({
//     createTransport: jest.fn(),
// }));

// const mockNodeMailer = require("nodemailer");

const NotificationProvider = require("./notification-provider");

beforeEach(() => {
    // mockNodeMailer.createTransport.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new NotificationProvider();
        expect(notification.name).toBe(undefined);
    });
});

describe("notification to error if blank notification called", () => {
    it("should respond with an error if just called.", async () => {

        let notif = new NotificationProvider();
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
            expect(e.message).toBe("Have to override Notification.send(...)");
        }

    });

});
