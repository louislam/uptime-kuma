// jest.mock("nodemailer", () => ({
//     createTransport: jest.fn(),
// }));

// const mockNodeMailer = require("nodemailer");

const Telegram = require("./telegram");

beforeEach(() => {
    // mockNodeMailer.createTransport.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Telegram();
        expect(notification.name).toBe("telegram");
    });
});
