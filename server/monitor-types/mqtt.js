const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const mqtt = require("mqtt");
const jsonata = require("jsonata");

class MqttMonitorType extends MonitorType {
    name = "mqtt";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const receivedMessage = await this.mqttAsync(monitor.hostname, monitor.mqttTopic, {
            port: monitor.port,
            username: monitor.mqttUsername,
            password: monitor.mqttPassword,
            interval: monitor.interval,
            websocketPath: monitor.mqttWebsocketPath,
        });

        if (monitor.mqttCheckType == null || monitor.mqttCheckType === "") {
            // use old default
            monitor.mqttCheckType = "keyword";
        }

        if (monitor.mqttCheckType === "keyword") {
            if (receivedMessage != null && receivedMessage.includes(monitor.mqttSuccessMessage)) {
                heartbeat.msg = `Topic: ${monitor.mqttTopic}; Message: ${receivedMessage}`;
                heartbeat.status = UP;
            } else {
                throw Error(`Message Mismatch - Topic: ${monitor.mqttTopic}; Message: ${receivedMessage}`);
            }
        } else if (monitor.mqttCheckType === "json-query") {
            const parsedMessage = JSON.parse(receivedMessage);

            let expression = jsonata(monitor.jsonPath);

            let result = await expression.evaluate(parsedMessage);

            if (result?.toString() === monitor.expectedValue) {
                heartbeat.msg = "Message received, expected value is found";
                heartbeat.status = UP;
            } else {
                throw new Error("Message received but value is not equal to expected value, value was: [" + result + "]");
            }
        } else {
            throw Error("Unknown MQTT Check Type");
        }
    }

    /**
     * Connect to MQTT Broker, subscribe to topic and receive message as String
     * @param {string} hostname Hostname / address of machine to test
     * @param {string} topic MQTT topic
     * @param {object} options MQTT options. Contains port, username,
     * password, websocketPath and interval (interval defaults to 20)
     * @returns {Promise<string>} Received MQTT message
     */
    mqttAsync(hostname, topic, options = {}) {
        return new Promise((resolve, reject) => {
            const { port, username, password, websocketPath, interval = 20 } = options;

            // Adds MQTT protocol to the hostname if not already present
            if (!/^(?:http|mqtt|ws)s?:\/\//.test(hostname)) {
                hostname = "mqtt://" + hostname;
            }

            const timeoutID = setTimeout(() => {
                log.debug("mqtt", "MQTT timeout triggered");
                client.end();
                reject(new Error("Timeout, Message not received"));
            }, interval * 1000 * 0.8);

            // Construct the URL based on protocol
            let mqttUrl = `${hostname}:${port}`;
            if (hostname.startsWith("ws://") || hostname.startsWith("wss://")) {
                if (websocketPath && !websocketPath.startsWith("/")) {
                    mqttUrl = `${hostname}:${port}/${websocketPath || ""}`;
                } else {
                    mqttUrl = `${hostname}:${port}${websocketPath || ""}`;
                }
            }

            log.debug("mqtt", `MQTT connecting to ${mqttUrl}`);

            let client = mqtt.connect(mqttUrl, {
                username,
                password,
                clientId: "uptime-kuma_" + Math.random().toString(16).substr(2, 8)
            });

            client.on("connect", () => {
                log.debug("mqtt", "MQTT connected");

                try {
                    client.subscribe(topic, () => {
                        log.debug("mqtt", "MQTT subscribed to topic");
                    });
                } catch (e) {
                    client.end();
                    clearTimeout(timeoutID);
                    reject(new Error("Cannot subscribe topic"));
                }
            });

            client.on("error", (error) => {
                client.end();
                clearTimeout(timeoutID);
                reject(error);
            });

            client.on("message", (messageTopic, message) => {
                if (messageTopic === topic) {
                    client.end();
                    clearTimeout(timeoutID);
                    resolve(message.toString("utf8"));
                }
            });

        });
    }
}

module.exports = {
    MqttMonitorType,
};
