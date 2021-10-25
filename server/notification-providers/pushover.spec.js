jest.mock("axios", () => ({
    post: jest.fn(),
}));

const axios = require("axios");
const { UP, DOWN } = require("../../src/util");
const NotificationSend = require("../notification");

beforeEach(() => {
    axios.post.mockReset();
});
const Pushover = require("./pushover");

describe("notification default information", () => {
    it("should have the correct name", () => {
        let notification = new Pushover();
        expect(notification.name).toBe("pushover");
    });
});

// describe("notification to act properly on send", () => {
//     it("should call axios with the proper default data", async () => {

//         let response = {
//             data: {
//                 Message: "OK"
//             }
//         };
//         axios.post.mockResolvedValueOnce(response);

//         let notif = new Pushover();
//         let notificationConf = {
//             type: "octopush",
//             pushoveruserkey: "123",
//             pushoverapptoken: "token",
//             pushoversounds: "ding",
//             pushoverpriority: "6",
//             pushovertitle: "Important Title!",
//         };
//         let monitorConf = {
//         };
//         let heartbeatConf = {
//             time: "example time",
//         };
//         let msg = "PassedInMessage😀";
//         let res = await notif.send(notificationConf, msg, monitorConf, heartbeatConf);

//         expect(axios.post).toHaveBeenCalledWith("", {
//         });
//         expect(res).toBe("Sent Successfully.");
//     });

//     it("should call axios with the proper data when monitor nil", async () => {
//         let response = {
//             data: {
//                 Message: "OK"
//             }
//         };
//         axios.post.mockResolvedValueOnce(response);

//         let notif = new Pushover();
//         let notificationConf = {
//             type: "octopush",
//             pushoveruserkey: "123",
//             pushoverapptoken: "token",
//             pushoversounds: "ding",
//             pushoverpriority: "6",
//             pushovertitle: "Important Title!",
//         };
//         let msg = "PassedInMessage😀";

//         let res = await notif.send(notificationConf, msg, null, null);

//         expect(axios.post).toHaveBeenCalledWith("", {
//         });
//         expect(res).toBe("Sent Successfully.");
//     });

// });

// describe("notification to act properly on error", () => {
//     it("should respond with an axios error on error", async () => {

//         axios.post.mockImplementation(() => {
//             throw new Error("Test Error");
//         });
//         let notif = new Pushover();
//         let notificationConf = {
//             type: "octopush",
//             pushoveruserkey: "123",
//             pushoverapptoken: "token",
//             pushoversounds: "ding",
//             pushoverpriority: "6",
//             pushovertitle: "Important Title!",
//         };
//         let msg = "PassedInMessage😀";

//         try {
//             await notif.send(notificationConf, msg, null, null);
//             expect("Error thrown").toBe(false);
//         } catch (e) {
//             expect(e.message).toBe("Error: Error: Test Error ");
//         }

//         expect(axios.post).toHaveBeenCalledWith("", {
//         });
//     });

// });

// describe("notification to get proper data from Notification.send", () => {
//     it("should call axios with proper data", async () => {
//         let response = {
//             data: {
//                 Message: "OK"
//             }
//         };
//         axios.post.mockResolvedValueOnce(response);
//         let notificationConf = {
//             type: "octopush",
//             pushoveruserkey: "123",
//             pushoverapptoken: "token",
//             pushoversounds: "ding",
//             pushoverpriority: "6",
//             pushovertitle: "Important Title!",
//         };
//         let monitorConf = {
//         };
//         let heartbeatConf = {
//             time: "example time",
//         };
//         let msg = "PassedInMessage😀";

//         NotificationSend.Notification.init();
//         let res = await NotificationSend.Notification.send(notificationConf, msg, monitorConf, heartbeatConf);
//         expect(axios.post).toHaveBeenCalledWith("", {
//         });
//         expect(res).toBe("Sent Successfully.");
//     });

// });
