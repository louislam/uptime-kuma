const { sendDockerHostList } = require("../client");
const { checkLogin } = require("../util-server");
const { DockerHost } = require("../docker");

module.exports.dockerSocketHandler = (socket) => {
    socket.on("addDockerHost", async (dockerHost, dockerHostID, callback) => {
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
            })
        }
    });

    socket.on("deleteDockerHost", async (dockerHostID, callback) => {
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
            })
        }
    });

    socket.on("testDockerHost", async (dockerHost, callback) => {
        try {
            checkLogin(socket);

            let amount = await DockerHost.getAmountContainer(dockerHost);

            callback({
                ok: true,
                msg: "Amount of containers: " + amount,
            });

        } catch (e) {
            console.error(e);

            callback({
                ok: false,
                msg: e.message,
            })
        }
    })
}