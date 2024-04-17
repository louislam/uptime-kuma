const { log } = require("../src/util");

const mqttUsername = process.env.MQTT_USERNAME;
const mqttPassword = process.env.MQTT_PASSWORD;

class SimpleMqttServer {
    aedes = require("aedes")();
    server = require("net").createServer(this.aedes.handle);
    constructor(port) {
        this.port = port;
    }
    start() {
        this.server.listen(this.port, () => {
            log.info('mqtt_server', `Server started and listening on port ${this.port}`);
        });
    }
    authenticateClient(client, username, passwordReceived, callback) {
        if (username && passwordReceived) {
            const isAuthentic = username === mqttUsername && passwordReceived.toString('utf-8') === mqttPassword;
            callback(null, isAuthentic);
        } else {
            callback(null, false);
        }
    }
    handleSubscriptions(subscriptions) {
        subscriptions.forEach(subscription => {
            if (subscription.topic === "test") {
                this.aedes.publish({
                    topic: "test",
                    payload: Buffer.from("ok"),
                }, (error) => {
                    if (error) {
                        log.error('mqtt_server', error);
                    }
                });
            }
        });
    }
}
server1.aedes.authenticate = server1.authenticateClient.bind(server1);
server1.aedes.on("subscribe", server1.handleSubscriptions.bind(server1));


server1.start();
