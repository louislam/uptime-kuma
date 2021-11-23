jest.mock("axios");

const axios = require("axios");

const { UP } = require("../../src/util");
const NotificationSend = require("../notification");

const AliyunSMS = require("./aliyun-sms");

beforeEach(() => {
    axios.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new AliyunSMS();
        expect(notification.name).toBe("AliyunSMS");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementation(() =>
                new Date("2019-05-14T11:01:58.135Z")
            );

        jest.spyOn(global.Math, "random")
            .mockImplementation(() =>
                0.0000111010100
            );

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new AliyunSMS();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios).toHaveBeenCalledWith({
            data: "TemplateParam=%7B%22name%22%3A%22testing%22%2C%22time%22%3A%22example%20time%22%2C%22status%22%3A%22UP%22%2C%22msg%22%3A%22some%20message%22%7D&Format=JSON&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0&SignatureNonce=0.00001110101&Timestamp=2019-05-14T11%3A01%3A58.135Z&Action=SendSms&Version=2017-05-25&Signature=73QTXvIaPHJIEo%2BCV1bzaZ5rzh4%3D",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementation(() =>
                new Date("2019-05-14T11:01:58.135Z")
            );

        jest.spyOn(global.Math, "random")
            .mockImplementation(() =>
                0.0000111010100
            );

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new AliyunSMS();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios).toHaveBeenCalledWith({
            data: "TemplateParam=%7B%22name%22%3A%22%22%2C%22time%22%3A%22%22%2C%22status%22%3A%22%22%2C%22msg%22%3A%22PassedInMessage%22%7D&Format=JSON&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0&SignatureNonce=0.00001110101&Timestamp=2019-05-14T11%3A01%3A58.135Z&Action=SendSms&Version=2017-05-25&Signature=bXj4C8u60n6Xfiqf3VhtyqtW6Fk%3D",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {

        jest.spyOn(global.Date, "now")
            .mockImplementation(() =>
                new Date("2019-05-14T11:01:58.135Z")
            );

        jest.spyOn(global.Math, "random")
            .mockImplementation(() =>
                0.0000111010100
            );

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.mockResolvedValueOnce(response);

        let notif = new AliyunSMS();
        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios).toHaveBeenCalledWith({
            data: "TemplateParam=%7B%22name%22%3A%22%22%2C%22time%22%3A%22%22%2C%22status%22%3A%22%22%2C%22msg%22%3A%22PassedInMessage%22%7D&Format=JSON&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0&SignatureNonce=0.00001110101&Timestamp=2019-05-14T11%3A01%3A58.135Z&Action=SendSms&Version=2017-05-25&Signature=bXj4C8u60n6Xfiqf3VhtyqtW6Fk%3D",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {
        jest.spyOn(global.Date, "now")
            .mockImplementation(() =>
                new Date("2019-05-14T11:01:58.135Z")
            );

        jest.spyOn(global.Math, "random")
            .mockImplementation(() =>
                0.0000111010100
            );

        axios.mockImplementation(() => {
            throw new Error("Test Error");
        });

        let notificationConf = {
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let msg = "PassedInMessage";
        let notif = new AliyunSMS();

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            //axios general error on catching another error is not the cleanest, but works.
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios).toHaveBeenCalledWith({
            data: "TemplateParam=%7B%22name%22%3A%22%22%2C%22time%22%3A%22%22%2C%22status%22%3A%22%22%2C%22msg%22%3A%22PassedInMessage%22%7D&Format=JSON&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0&SignatureNonce=0.00001110101&Timestamp=2019-05-14T11%3A01%3A58.135Z&Action=SendSms&Version=2017-05-25&Signature=bXj4C8u60n6Xfiqf3VhtyqtW6Fk%3D",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
        });
    });

});

describe("notification to get proper data from Notification.send", () => {
    it("should call sendMail with proper data", async () => {
        jest.spyOn(global.Date, "now")
            .mockImplementation(() =>
                new Date("2019-05-14T11:01:58.135Z")
            );

        jest.spyOn(global.Math, "random")
            .mockImplementation(() =>
                0.0000111010100
            );

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.mockResolvedValueOnce(response);
        let notificationConf = {
            type: "AliyunSMS",
            appriseURL: "appriseURL",
            secretKey: "abc",
            webHookUrl: "https://example.com/webhook",
        };
        let monitorConf = {
            type: "http",
            url: "https://www.google.com",
            name: "testing",
        };
        let heartbeatConf = {
            status: UP,
            msg: "some message",
            time: "example time",
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);
        expect(axios).toHaveBeenCalledWith({
            data: "TemplateParam=%7B%22name%22%3A%22testing%22%2C%22time%22%3A%22example%20time%22%2C%22status%22%3A%22UP%22%2C%22msg%22%3A%22some%20message%22%7D&Format=JSON&SignatureMethod=HMAC-SHA1&SignatureVersion=1.0&SignatureNonce=0.00001110101&Timestamp=2019-05-14T11%3A01%3A58.135Z&Action=SendSms&Version=2017-05-25&Signature=73QTXvIaPHJIEo%2BCV1bzaZ5rzh4%3D",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
        });
        expect(res).toBe("Sent Successfully.");
    });

});
