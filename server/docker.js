const axios = require("axios");
const { R } = require("redbean-node");
const version = require("../package.json").version;
const https = require("https");

class DockerHost {
    /**
     * Save a docker host
     * @param {Object} dockerHost Docker host to save
     * @param {?number} dockerHostID ID of the docker host to update
     * @param {number} userID ID of the user who adds the docker host
     * @returns {Promise<Bean>}
     */
    static async save(dockerHost, dockerHostID, userID) {
        let bean;

        if (dockerHostID) {
            bean = await R.findOne("docker_host", " id = ? AND user_id = ? ", [ dockerHostID, userID ]);

            if (!bean) {
                throw new Error("docker host not found");
            }

        } else {
            bean = R.dispense("docker_host");
        }

        bean.user_id = userID;
        bean.docker_daemon = dockerHost.docker_daemon;
        bean.docker_type = dockerHost.docker_type;
        bean.name = dockerHost.name;

        await R.store(bean);

        return bean;
    }

    /**
     * Delete a Docker host
     * @param {number} dockerHostID ID of the Docker host to delete
     * @param {number} userID ID of the user who created the Docker host
     * @returns {Promise<void>}
     */
    static async delete(dockerHostID, userID) {
        let bean = await R.findOne("docker_host", " id = ? AND user_id = ? ", [ dockerHostID, userID ]);

        if (!bean) {
            throw new Error("docker host not found");
        }

        // Delete removed proxy from monitors if exists
        await R.exec("UPDATE monitor SET docker_host = null WHERE docker_host = ?", [ dockerHostID ]);

        await R.trash(bean);
    }

    /**
     * Fetches the amount of containers on the Docker host
     * @param {Object} dockerHost Docker host to check for
     * @returns {number} Total amount of containers on the host
     */
    static async getAmountContainer(dockerHost) {
        const options = {
            url: "/containers/json?all=true",
            headers: {
                "Accept": "*/*",
                "User-Agent": "Uptime-Kuma/" + version
            },
            httpsAgent: new https.Agent({
                maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                rejectUnauthorized: false,
            }),
        };

        if (dockerHost.docker_type === "socket") {
            options.socketPath = dockerHost.docker_daemon;
        } else if (dockerHost.docker_type === "tcp") {
            options.baseURL = dockerHost.docker_daemon;
        }

        let res = await axios.request(options);
        return res.data.length;
    }
}

module.exports = {
    DockerHost,
};
