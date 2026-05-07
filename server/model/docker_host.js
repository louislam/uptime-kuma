const { BaseModel } = require("./base-model");

class DockerHost extends BaseModel {
    static tableName = "docker_host";

    /**
     * Returns an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            userID: this.user_id,
            dockerDaemon: this.docker_daemon,
            dockerType: this.docker_type,
            name: this.name,
        };
    }
}

module.exports = DockerHost;
