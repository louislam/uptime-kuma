// jest.mock("nodemailer", () => ({
//     createTransport: jest.fn(),
// }));

// const mockNodeMailer = require("nodemailer");

const Slack = require("./slack");

beforeEach(() => {
    // mockNodeMailer.createTransport.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Slack();
        expect(notification.name).toBe("slack");
    });
});
