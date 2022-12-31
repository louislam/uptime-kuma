const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const { passwordStrength } = require("check-password-strength");
const passwordHash = require("../password-hash");

/**
 * Handlers for Sub Users
 * @param {Socket} socket Socket.io instance
 */

module.exports.subUserSocketHandler = (socket) => {
    // Add a new sub user
    socket.on("addSubUser", async (username, password, callback) => {
        try {

              if (passwordStrength(password).value === "Too weak") {
                  throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
              }

             log.debug("sub_users", `Add Sub User: ${username}`);

              let subuser = R.dispense("sub_users");
              subuser.username = username;
              subuser.password = passwordHash.generate(password);
              let subuserID = await R.store(subuser);

              await server.sendSubUserList(socket);

            callback({
                ok: true,
                msg: "Added Successfully.",
                subuserID,
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteSubUser", async (subuserID, callback) => {
        try {
            checkLogin(socket);

            log.debug("sub_users", `Delete Sub User: ${subuserID}`);

            if (subuserID in server.subUserList) {
                delete server.subUserList[subuserID];
            }

            await R.exec("DELETE FROM sub_users WHERE id = ?", [
                subuserID,
            ]);

            callback({
                ok: true,
                msg: "Deleted Successfully.",
            });

            await server.sendSubUserList(socket);

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Edit a subusers permissions

    socket.on("editSubUserPermissions", async (subuser, callback) => {
        try {
            checkLogin(socket);

            let bean = await R.findOne("subuser", " id = ? ", [ subuser.id ]);

            if (bean.user_id !== socket.userID) {
                throw new Error("Permission denied.");
            }

            Maintenance.jsonToBean(bean, maintenance);

            await R.store(bean);
            // await MaintenanceTimeslot.generateTimeslot(bean, null, true);

            await server.sendSubUserList(socket);

            callback({
                ok: true,
                msg: "Saved.",
                maintenanceID: bean.id,
            });

        } catch (e) {
            console.error(e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
