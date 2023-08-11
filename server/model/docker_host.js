const { BeanModel } = require("redbean-node/dist/bean-model");

class DockerHost extends BeanModel {
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
