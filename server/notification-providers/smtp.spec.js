jest.mock("nodemailer", () => ({
    createTransport: jest.fn(),
}));
const mockNodeMailer = require("nodemailer");
const { UP } = require("../../src/util");
const NotificationSend = require("../notification");

const SMTP = require("./smtp");

beforeEach(() => {
    mockNodeMailer.createTransport.mockReset();
});

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
            customSubject: "",
            smtpFrom: "From",
            smtpCC: "CC",
            smtpBCC: "BCC",
            smtpTo: "To",
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
            tls: {
                "rejectUnauthorized": false,
            }
        });
        expect(res).toBe("Sent Successfully.");
        expect(sender).toHaveBeenCalledWith({
            bcc: "BCC",
            cc: "CC",
            from: "From",
            subject: "PassedInMessage",
            text: "PassedInMessage\nTime (UTC): undefined",

            to: "To",

        });
    });

    it("should use the proper email subject", async () => {
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
            customSubject: "Name: {{NAME}} | Status: {{STATUS}} | Hostname: {{HOSTNAME_OR_URL}}",
            smtpFrom: "From",
            smtpCC: "CC",
            smtpBCC: "BCC",
            smtpTo: "To",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,

        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(mockNodeMailer.createTransport).toHaveBeenCalledWith({
            auth: {
                pass: "password",
                user: "username",
            },
            host: "host",
            port: "port",
            secure: "secure",
            tls: {
                "rejectUnauthorized": false,
            }
        });
        expect(res).toBe("Sent Successfully.");
        expect(sender).toHaveBeenCalledWith({
            bcc: "BCC",
            cc: "CC",
            from: "From",
            subject: "Name: testing | Status: ✅ Up | Hostname: https://www.google.com",
            text: "PassedInMessage\nTime (UTC): undefined",
            to: "To",
        });
    });
});

describe("notification to act properly on error from transport", () => {
    it("should pass a createTransport error on", async () => {
        let sender = jest.fn()
            .mockResolvedValue(() => {
                return;
            });
        mockNodeMailer.createTransport.mockImplementationOnce(() => {
            throw new Error("Test Error");
        });

        let notif = new SMTP();
        let notificationConf = { };
        let msg = "PassedInMessage";
        let monitorConf = { };
        let heartbeatConf = { };
        let res = "";
        try {
            res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);
            expect(true).toBe(false);
        } catch (e) {
            expect(e.message).toBe("Test Error");
        }

        expect(mockNodeMailer.createTransport).toHaveBeenCalledTimes(1);
        expect(res).toBe("");
        expect(sender).toHaveBeenCalledTimes(0);
    });

    it("should pass a send mail error on", async () => {
        let sender = jest.fn()
            .mockRejectedValue(new Error("Test Error"));
        mockNodeMailer.createTransport.mockImplementationOnce(() => {
            return { sendMail: sender };

        });

        let notif = new SMTP();
        let notificationConf = { };
        let msg = "PassedInMessage";
        let monitorConf = { };
        let heartbeatConf = { };
        let res = "";
        try {
            res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);
            expect("threw error").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Test Error");
        }

        expect(mockNodeMailer.createTransport).toHaveBeenCalledTimes(1);
        expect(res).toBe("");
        expect(sender).toHaveBeenCalledTimes(1);
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call sendMail with proper data", async () => {
        let sender = jest.fn()
            .mockResolvedValue(() => {
                return;
            });
        mockNodeMailer.createTransport.mockImplementationOnce(() => {
            return { sendMail: sender };
        });

        let notificationConf = {
            type: "smtp",
            smtpHost: "host",
            smtpPort: "port",
            smtpSecure: "secure",
            smtpUsername: "username",
            smtpPassword: "password",
            customSubject: "",
            smtpFrom: "From",
            smtpCC: "CC",
            smtpBCC: "BCC",
            smtpTo: "To",
            smtpIgnoreTLSError: true,
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "simple message", monitorConf, heartbeatConf);

        expect(res).toBe("Sent Successfully.");

        expect(mockNodeMailer.createTransport).toHaveBeenCalledTimes(1);
        expect(mockNodeMailer.createTransport).toHaveBeenCalledWith({
            auth: {
                pass: "password",
                user: "username",
            },
            host: "host",
            port: "port",
            secure: "secure",
            tls: {
                "rejectUnauthorized": true,
            }
        });
        expect(sender).toHaveBeenCalledTimes(1);
        expect(sender).toHaveBeenCalledWith({
            bcc: "BCC",
            cc: "CC",
            from: "From",
            subject: "simple message",
            text: "simple message\nTime (UTC): undefined",
            to: "To",
        });
    });

});
