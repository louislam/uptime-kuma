const axios = require("axios");
const { R } = require("redbean-node");
const https = require("https");
const fsAsync = require("fs").promises;
const path = require("path");
const Database = require("./database");
const { axiosAbortSignal, fsExists } = require("./util-server");

class DockerHost {

    static CertificateFileNameCA = "ca.pem";
    static CertificateFileNameCert = "cert.pem";
    static CertificateFileNameKey = "key.pem";

    /**
     * Save a docker host
     * @param {object} dockerHost Docker host to save
     * @param {?number} dockerHostID ID of the docker host to update
     * @param {number} userID ID of the user who adds the docker host
     * @returns {Promise<Bean>} Updated docker host
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
        bean.docker_daemon = dockerHost.dockerDaemon;
        bean.docker_type = dockerHost.dockerType;
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
     * @param {object} dockerHost Docker host to check for
     * @returns {Promise<number>} Total amount of containers on the host
     */
    static async testDockerHost(dockerHost) {
        const options = {
            url: "/containers/json?all=true",
            timeout: 5000,
            headers: {
                "Accept": "*/*",
            },
            signal: axiosAbortSignal(6000),
        };

        if (dockerHost.dockerType === "socket") {
            options.socketPath = dockerHost.dockerDaemon;
        } else if (dockerHost.dockerType === "tcp") {
            options.baseURL = DockerHost.patchDockerURL(dockerHost.dockerDaemon);
            options.httpsAgent = new https.Agent(await DockerHost.getHttpsAgentOptions(dockerHost.dockerType, options.baseURL));
        }

        try {
            let res = await axios.request(options);

            if (Array.isArray(res.data)) {

                if (res.data.length > 1) {

                    if ("ImageID" in res.data[0]) {
                        return res.data.length;
                    } else {
                        throw new Error("Invalid Docker response, is it Docker really a daemon?");
                    }

                } else {
                    return res.data.length;
                }

            } else {
                throw new Error("Invalid Docker response, is it Docker really a daemon?");
            }
        } catch (e) {
            if (e.code === "ECONNABORTED" || e.name === "CanceledError") {
                throw new Error("Connection to Docker daemon timed out.");
            } else {
                throw e;
            }
        }
    }

    /**
     * Since axios 0.27.X, it does not accept `tcp://` protocol.
     * Change it to `http://` on the fly in order to fix it. (https://github.com/louislam/uptime-kuma/issues/2165)
     * @param {any} url URL to fix
     * @returns {any} URL with tcp:// replaced by http://
     */
    static patchDockerURL(url) {
        if (typeof url === "string") {
            // Replace the first occurrence only with g
            return url.replace(/tcp:\/\//g, "http://");
        }
        return url;
    }

    /**
     * Returns HTTPS agent options with client side TLS parameters if certificate files
     * for the given host are available under a predefined directory path.
     *
     * The base path where certificates are looked for can be set with the
     * 'DOCKER_TLS_DIR_PATH' environmental variable or defaults to 'data/docker-tls/'.
     *
     * If a directory in this path exists with a name matching the FQDN of the docker host
     * (e.g. the FQDN of 'https://example.com:2376' is 'example.com' so the directory
     * 'data/docker-tls/example.com/' would be searched for certificate files),
     * then 'ca.pem', 'key.pem' and 'cert.pem' files are included in the agent options.
     * File names can also be overridden via 'DOCKER_TLS_FILE_NAME_(CA|KEY|CERT)'.
     * @param {string} dockerType i.e. "tcp" or "socket"
     * @param {string} url The docker host URL rewritten to https://
     * @returns {Promise<object>} HTTP agent options
     */
    static async getHttpsAgentOptions(dockerType, url) {
        let baseOptions = {
            maxCachedSessions: 0,
            rejectUnauthorized: true
        };
        let certOptions = {};

        let dirName = (new URL(url)).hostname;

        let caPath = path.join(Database.dockerTLSDir, dirName, DockerHost.CertificateFileNameCA);
        let certPath = path.join(Database.dockerTLSDir, dirName, DockerHost.CertificateFileNameCert);
        let keyPath = path.join(Database.dockerTLSDir, dirName, DockerHost.CertificateFileNameKey);

        if (dockerType === "tcp" && await fsExists(caPath) && await fsExists(certPath) && await fsExists(keyPath)) {
            let ca = await fsAsync.readFile(caPath);
            let key = await fsAsync.readFile(keyPath);
            let cert = await fsAsync.readFile(certPath);
            certOptions = {
                ca,
                key,
                cert
            };
        }

        return {
            ...baseOptions,
            ...certOptions
        };
    }
}

module.exports = {
    DockerHost,
};
