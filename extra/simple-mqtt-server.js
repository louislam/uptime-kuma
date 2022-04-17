const { log } = require("../src/util");

const mqttUsername = "louis1";
const mqttPassword = "!@#$LLam";

class SimpleMqttServer {
    aedes = require("aedes")();
    server = require("net").createServer(this.aedes.handle);

    constructor(port) {
        this.port = port;
    }

    start() {
        this.server.listen(this.port, () => {
            console.log("server started and listening on port ", this.port);
        });
    }
}

let server1 = new SimpleMqttServer(10000);

server1.aedes.authenticate = function (client, username, password, callback) {
    if (username && password) {
        console.log(password.toString("utf-8"));
        callback(null, username === mqttUsername && password.toString("utf-8") === mqttPassword);
    } else {
        callback(null, false);
    }
};

server1.aedes.on("subscribe", (subscriptions, client) => {
    console.log(subscriptions);

    for (let s of subscriptions) {
        if (s.topic === "test") {
            server1.aedes.publish({
                topic: "test",
                payload: Buffer.from("ok"),
            }, (error) => {
                if (error) {
                    log.error("mqtt_server", error);
                }
            });
        }
    }

});

server1.start();
