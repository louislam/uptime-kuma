jest.mock("axios", () => ({
    put: jest.fn(),
}));
jest.mock("crypto", () => ({
    randomBytes: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

const Matrix = require("./matrix");
const Crypto = require("crypto");

beforeEach(() => {
    axios.put.mockReset();
    Crypto.randomBytes.mockReset();
});

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Matrix();
        expect(notification.name).toBe("matrix");
    });
});

describe("notification to act properly on send", () => {
    it("should call axios with the proper default data", async () => {

        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.put.mockResolvedValueOnce(response);
        Crypto.randomBytes.mockReturnValueOnce(new Buffer("abcd"));

        let notif = new Matrix();

        let msg = "PassedInMessage";
        let notificationConf = {
            type: "matrix",
            internalRoomId: "1234",
            accessToken: "abcd",
            homeserverUrl: "www.example.com",
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

        expect(axios.put).toHaveBeenCalledWith("www.example.com/_matrix/client/r0/rooms/1234/send/m.room.message/YWJjZA%3D%3D", {
            body: "PassedInMessage",
            msgtype: "m.text"
        }, {
            headers: {
                "Authorization": "Bearer abcd"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });

    it("should call axios with the proper data when monitor nil", async () => {
        let response = {
            data: {
                Message: "OK"
            }
        };
        axios.put.mockResolvedValueOnce(response);
        Crypto.randomBytes.mockReturnValueOnce(new Buffer("abcd"));

        let notif = new Matrix();
        let notificationConf = {
            type: "matrix",
            internalRoomId: "1234",
            accessToken: "abcd",
            homeserverUrl: "www.example.com",
        };
        let msg = "PassedInMessage";

        let res = await notif.send(notificationConf, msg, null, null);

        expect(axios.put).toHaveBeenCalledWith("www.example.com/_matrix/client/r0/rooms/1234/send/m.room.message/YWJjZA%3D%3D", {
            body: "PassedInMessage",
            msgtype: "m.text"
        }, {
            headers: {
                "Authorization": "Bearer abcd"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });

});

describe("notification to act properly on error", () => {
    it("should respond with an axios error on error", async () => {

        axios.put.mockImplementation(() => {
            throw new Error("Test Error");
        });
        Crypto.randomBytes.mockReturnValueOnce(new Buffer("abcd"));

        let notif = new Matrix();
        let notificationConf = {
            type: "matrix",
            internalRoomId: "1234",
            accessToken: "abcd",
            homeserverUrl: "www.example.com",
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };
        let msg = "PassedInMessage";

        try {
            await notif.send(notificationConf, msg, null, null);
            expect("Error thrown").toBe(false);
        } catch (e) {
            expect(e.message).toBe("Error: Error: Test Error ");
        }

        expect(axios.put).toHaveBeenCalledWith("www.example.com/_matrix/client/r0/rooms/1234/send/m.room.message/YWJjZA%3D%3D", {
            body: "PassedInMessage",
            msgtype: "m.text"
        }, {
            headers: {
                "Authorization": "Bearer abcd"
            }
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
        axios.put.mockResolvedValueOnce(response);
        Crypto.randomBytes.mockReturnValueOnce(new Buffer("abcd"));

        let notificationConf = {
            type: "matrix",
            internalRoomId: "1234",
            accessToken: "abcd",
            homeserverUrl: "www.example.com",
        };
        let monitorConf = {
        };
        let heartbeatConf = {
        };

        NotificationSend.Notification.init();
        let res = await NotificationSend.Notification.send(notificationConf, "PassedInMessage", monitorConf, heartbeatConf);
        expect(axios.put).toHaveBeenCalledWith("www.example.com/_matrix/client/r0/rooms/1234/send/m.room.message/YWJjZA%3D%3D", {
            body: "PassedInMessage",
            msgtype: "m.text"
        }, {
            headers: {
                "Authorization": "Bearer abcd"
            }
        });
        expect(res).toBe("Sent Successfully.");
    });

});
