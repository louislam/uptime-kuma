const { sendDockerHostList } = require("../client");
const { checkLogin } = require("../util-server");
const { DockerHost } = require("../docker");
const { log } = require("../../src/util");

/**
 * Handlers for docker hosts
 * @param {Socket} socket Socket.io instance
 */
module.exports.dockerSocketHandler = (socket) => {
    socket.on("addDockerHost", async (dockerHost, dockerHostID, callback) => {

        log.debug("server/socket-handlers/docker-socket-handler.js/dockerSocketHandler(socket)/socket.on(addDockerHost)","");

        try {
            checkLogin(socket);

            let dockerHostBean = await DockerHost.save(dockerHost, dockerHostID, socket.userID);
            await sendDockerHostList(socket);

            callback({
                ok: true,
                msg: "Saved",
                id: dockerHostBean.id,
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteDockerHost", async (dockerHostID, callback) => {

        log.debug("server/socket-handlers/docker-socket-handler.js/dockerSocketHandler(socket)/socket.on(deleteDockerHost)","");

        try {
            checkLogin(socket);

            await DockerHost.delete(dockerHostID, socket.userID);
            await sendDockerHostList(socket);

            callback({
                ok: true,
                msg: "Deleted",
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("testDockerHost", async (dockerHost, callback) => {

        log.debug("server/socket-handlers/docker-socket-handler.js/dockerSocketHandler(socket)/socket.on(testDockerHost)","");

        try {
            checkLogin(socket);

            let amount = await DockerHost.testDockerHost(dockerHost);
            let msg;

            if (amount >= 1) {
                msg = "Connected Successfully. Amount of containers: " + amount;
            } else {
                msg = "Connected Successfully, but there are no containers?";
            }

            callback({
                ok: true,
                msg,
            });

        } catch (e) {
            log.error("docker", e);

            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
