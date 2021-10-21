jest.mock("nodemailer", () => ({
    createTransport: jest.fn(),
}));
const mockNodeMailer = require("nodemailer");

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
        mockNodeMailer.createTransport.mockImplementationOnce(() => {
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
        let msg = "PassedInMessage";
        let monitorConf = { };
        let heartbeatConf = { };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(mockNodeMailer.createTransport).toHaveBeenCalledWith({
            auth: {
                pass: "password",
                user: "username",
            },
            host: "host",
            port: "port",
            secure: "secure",
        });
        expect(res).toBe("Sent Successfully.");
        expect(sender).toHaveBeenCalledWith({
            bcc: undefined,
            cc: undefined,
            from: undefined,
            subject: "custom subject",
            text: "PassedInMessage\nTime (UTC): undefined",
            tls: {
                rejectUnauthorized: false,
            },
            to: undefined,
        });
    });
});
