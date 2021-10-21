// jest.mock("nodemailer", () => ({
//     createTransport: jest.fn(),
// }));

// const mockNodeMailer = require("nodemailer");

const Feishu = require("./feishu");

beforeEach(() => {
    // mockNodeMailer.createTransport.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Feishu();
        expect(notification.name).toBe("Feishu");
    });
});
