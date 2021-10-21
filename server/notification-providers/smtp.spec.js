jest.mock("nodemailer", () => ({
    createTransport: jest.fn(),
}));
const mockNodEmailer = require("nodemailer");

const SMTP = require("./smtp");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new SMTP();
        expect(notification.name).toBe("smtp");
    });
});

describe("notification to act properly on send", () => {
    it("should call transport with the proper default data", async () => {
        let sender = jest.fn()
            .mockResolvedValue(() => {
                return;
            });
        mockNodEmailer.createTransport.mockImplementationOnce(() => {
            return { sendMail: sender };
        });

        let notif = new SMTP();
        let notificationConf = {
            smtpHost: "host",
            smtpPort: "port",
            smtpSecure: "secure",
            smtpUsername: "username",
            smtpPassword: "password",
            customSubject: "custom subject",
        };
        let msg = "Message";
        let monitorConf = { };
        let heartbeatConf = { };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(mockNodEmailer.createTransport).toHaveBeenCalledWith({
            auth: {
                pass: "password",
                user: "username",
            },
            host: "host",
            port: "port",
            secure: "secure",
        });
        expect(res).toBe("Sent Successfully.");
    });
});
