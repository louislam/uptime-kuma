const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const mqtt = require("mqtt");
const jsonata = require("jsonata");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators, defaultNumberOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

const MAX_BUFFERED_MESSAGES = 1000;
const MQTT_KEEPALIVE_SECONDS = 30;

class MqttMonitorType extends MonitorType {
    name = "mqtt";

    supportsConditions = true;

    // List of persistent clients for monitors with "stay connected" mode enabled.
    // Key: monitor id, Value: { client, messageQueue, waiters, connected, ready }
    persistentClients = new Map();

    conditionVariables = [
        new ConditionVariable("topic", defaultStringOperators),
        new ConditionVariable("message", defaultStringOperators),
        new ConditionVariable("json_value", defaultStringOperators.concat(defaultNumberOperators)),
    ];

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        if (monitor.mqttCheckType == null || monitor.mqttCheckType === "") {
            monitor.mqttCheckType = "keyword";
        }

        const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        const hasConditions = conditions && conditions.children && conditions.children.length > 0;

        // If "stay connected" mode is enabled, use the persistent connection check
        // We don't need to connect
        if (monitor.mqttStayConnected) {
            await this.checkPersistent(monitor, heartbeat, hasConditions, conditions);
            return;
        }

        const [messageTopic, receivedMessage] = await this.mqttAsync(monitor.hostname, monitor.mqttTopic, {
            port: monitor.port,
            username: monitor.mqttUsername,
            password: monitor.mqttPassword,
            interval: monitor.interval,
            websocketPath: monitor.mqttWebsocketPath,
        });

        if (hasConditions) {
            await this.checkConditions(monitor, heartbeat, messageTopic, receivedMessage, conditions);
        } else if (monitor.mqttCheckType === "keyword") {
            this.checkKeyword(monitor, heartbeat, messageTopic, receivedMessage);
        } else if (monitor.mqttCheckType === "json-query") {
            await this.checkJsonQuery(monitor, heartbeat, receivedMessage);
        } else {
            throw new Error("Unknown MQTT Check Type");
        }
    }

    /**
     * Check using a persistent broker connection ("stay connected" mode).
     * The connection is kept alive between checks and the timeout is reset
     * every time a message is received.
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @param {boolean} hasConditions Whether conditions are defined
     * @param {ConditionExpressionGroup} conditions Parsed conditions
     * @returns {Promise<void>}
     */
    async checkPersistent(monitor, heartbeat, hasConditions, conditions) {
        // Setup the persistent client and subscribe to the topic if not already done
        await this.ensurePersistentClient(monitor);

        while (true) {
            let messageList = null;
            try {
                messageList = await this.waitForMessage(monitor);
            } catch (error) {
                this.closePersistentClient(monitor.id);
                throw error;
            }

            if (messageList === null) {
                throw new Error("Timeout, Message not received");
            }

            for (const [messageTopic, receivedMessage] of messageList) {
                // Here I take the choice to check IF one of the messages received matches the criteria,
                // instead of checking all of them and failing if one doesn't match.
                try {
                    if (hasConditions) {
                        await this.checkConditions(monitor, heartbeat, messageTopic, receivedMessage, conditions);
                    } else if (monitor.mqttCheckType === "json-query") {
                        await this.checkJsonQuery(monitor, heartbeat, receivedMessage);
                    } else {
                        this.checkKeyword(monitor, heartbeat, messageTopic, receivedMessage);
                    }
                    return;
                } catch (e) {
                    // The message does not match the check criteria: keep waiting,
                    // the timeout has been reset by the received message
                    log.debug(this.name, `MQTT message did not match the check criteria: ${e.message}`);
                }
            }
        }
    }

    //////////////////////////////////////////////
    /// CONDITIONS CHECKING METHODS
    //////////////////////////////////////////////

    /**
     * Check using keyword matching
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @param {string} messageTopic Received MQTT topic
     * @param {string} receivedMessage Received MQTT message
     * @returns {void}
     * @throws {Error} If keyword is not found in message
     */
    checkKeyword(monitor, heartbeat, messageTopic, receivedMessage) {
        if (receivedMessage != null && receivedMessage.includes(monitor.mqttSuccessMessage)) {
            heartbeat.msg = `Topic: ${messageTopic}; Message: ${receivedMessage}`;
            heartbeat.status = UP;
        } else {
            throw new Error(`Message Mismatch - Topic: ${monitor.mqttTopic}; Message: ${receivedMessage}`);
        }
    }

    /**
     * Check using JSONata query
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @param {string} receivedMessage Received MQTT message
     * @returns {Promise<void>}
     */
    async checkJsonQuery(monitor, heartbeat, receivedMessage) {
        const parsedMessage = JSON.parse(receivedMessage);
        const expression = jsonata(monitor.jsonPath);
        const result = await expression.evaluate(parsedMessage);

        if (result?.toString() === monitor.expectedValue) {
            heartbeat.msg = "Message received, expected value is found";
            heartbeat.status = UP;
        } else {
            throw new Error("Message received but value is not equal to expected value, value was: [" + result + "]");
        }
    }

    /**
     * Check using conditions system
     * @param {object} monitor Monitor object
     * @param {object} heartbeat Heartbeat object
     * @param {string} messageTopic Received MQTT topic
     * @param {string} receivedMessage Received MQTT message
     * @param {ConditionExpressionGroup} conditions Parsed conditions
     * @returns {Promise<void>}
     */
    async checkConditions(monitor, heartbeat, messageTopic, receivedMessage, conditions) {
        let jsonValue = null;

        // Parse JSON and extract value if jsonPath is defined
        if (monitor.jsonPath) {
            try {
                const parsedMessage = JSON.parse(receivedMessage);
                const expression = jsonata(monitor.jsonPath);
                jsonValue = await expression.evaluate(parsedMessage);
            } catch (e) {
                // JSON parsing failed, jsonValue remains null
            }
        }

        const conditionData = {
            topic: messageTopic,
            message: receivedMessage,
            json_value: jsonValue?.toString() ?? "",
        };

        const conditionsResult = evaluateExpressionGroup(conditions, conditionData);

        if (conditionsResult) {
            heartbeat.msg = `Topic: ${messageTopic}; Message: ${receivedMessage}`;
            heartbeat.status = UP;
        } else {
            throw new Error(`Conditions not met - Topic: ${messageTopic}; Message: ${receivedMessage}`);
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

            const timeoutID = setTimeout(
                () => {
                    log.debug(this.name, "MQTT timeout triggered");
                    client.end();
                    reject(new Error("Timeout, Message not received"));
                },
                interval * 1000 * 0.8
            );

            // Construct the URL based on protocol
            let mqttUrl = `${hostname}:${port}`;
            if (hostname.startsWith("ws://") || hostname.startsWith("wss://")) {
                if (websocketPath && !websocketPath.startsWith("/")) {
                    mqttUrl = `${hostname}:${port}/${websocketPath || ""}`;
                } else {
                    mqttUrl = `${hostname}:${port}${websocketPath || ""}`;
                }
            }

            log.debug(this.name, `MQTT connecting to ${mqttUrl}`);

            let client = mqtt.connect(mqttUrl, {
                username,
                password,
                clientId: "uptime-kuma_" + Math.random().toString(16).substr(2, 8),
            });

            client.on("connect", () => {
                log.debug(this.name, "MQTT connected");

                try {
                    client.subscribe(topic, () => {
                        log.debug(this.name, "MQTT subscribed to topic");
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
                client.end();
                clearTimeout(timeoutID);
                resolve([messageTopic, message.toString("utf8")]);
            });
        });
    }

    /**
     * Build the MQTT broker URL from the monitor configuration
     * @param {object} monitor Monitor object
     * @returns {string} MQTT broker URL
     */
    buildMqttUrl(monitor) {
        let hostname = monitor.hostname;
        // Adds MQTT protocol to the hostname if not already present
        if (!/^(?:http|mqtt|ws)s?:\/\//.test(hostname)) {
            hostname = "mqtt://" + hostname;
        }

        let mqttUrl = `${hostname}:${monitor.port}`;
        if (hostname.startsWith("ws://") || hostname.startsWith("wss://")) {
            const websocketPath = monitor.mqttWebsocketPath;
            if (websocketPath && !websocketPath.startsWith("/")) {
                mqttUrl = `${hostname}:${monitor.port}/${websocketPath || ""}`;
            } else {
                mqttUrl = `${hostname}:${monitor.port}${websocketPath || ""}`;
            }
        }
        return mqttUrl;
    }

    /**
     * Connect and subscribe once for a monitor with "stay connected" enabled.
     * MQTT.js sends protocol keepalive while the connection is idle.
     * @param {object} monitor Monitor object
     * @returns {Promise<void>}
     */
    async ensurePersistentClient(monitor) {
        let entry = this.persistentClients.get(monitor.id);

        if (entry) {
            if (entry.connected) {
                // The client is already connected, continue
                return;
            } else {
                // The client is disconnected, close it and create a new one
                this.closePersistentClient(monitor.id);
            }
        }

        const client = mqtt.connect(this.buildMqttUrl(monitor), {
            username: monitor.mqttUsername,
            password: monitor.mqttPassword,
            clientId: "uptime-kuma_" + Math.random().toString(16).substr(2, 8),
            keepalive: MQTT_KEEPALIVE_SECONDS,
        });

        entry = {
            client,
            messageQueue: [],
            waiters: [],
            connected: false,
            ready: null,
        };

        // Store the entry in the map before setting up event listeners
        this.persistentClients.set(monitor.id, entry);

        // Set up event listeners for the MQTT client
        entry.ready = new Promise((resolve, reject) => {
            client.on("connect", () => {
                client.subscribe(monitor.mqttTopic, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    entry.connected = true;
                    resolve();
                });
            });

            client.on("disconnect", () => {
                entry.connected = false;
                const error = new Error("Connection to MQTT broker lost");
                for (const waiter of [...entry.waiters]) {
                    waiter.reject(error);
                }
                reject(error);
            });

            client.on("message", (messageTopic, message) => {
                const receivedMessage = [messageTopic, message.toString("utf8")];
                const waiter = entry.waiters[0];

                if (waiter) {
                    waiter.resolve([receivedMessage]);
                } else {
                    if (entry.messageQueue.length >= MAX_BUFFERED_MESSAGES) {
                        entry.messageQueue.shift();
                    }
                    entry.messageQueue.push(receivedMessage);
                }
            });

            client.on("close", () => {
                entry.connected = false;
                const error = new Error("Connection to MQTT broker lost");
                for (const waiter of [...entry.waiters]) {
                    waiter.reject(error);
                }
                reject(error);
            });

            client.on("error", (error) => {
                for (const waiter of [...entry.waiters]) {
                    waiter.reject(error);
                }
                entry.connected = client.connected;
                if (!entry.connected) {
                    reject(error);
                }
            });
        });

        try {
            await entry.ready;
        } catch (error) {
            this.closePersistentClient(monitor.id);
            throw error;
        }
    }

    /**
     * Close and forget the persistent client of a monitor, if any
     * @param {number} monitorId Monitor id
     * @returns {void}
     */
    closePersistentClient(monitorId) {
        const entry = this.persistentClients.get(monitorId);
        if (entry) {
            // Reject pending waiters so no check stays blocked on a closed client
            for (const waiter of entry.waiters.splice(0)) {
                waiter.reject(new Error("Connection to MQTT broker lost"));
            }
            entry.client.removeAllListeners();
            entry.client.end(true);
            this.persistentClients.delete(monitorId);
            log.debug(this.name, `Persistent MQTT client for monitor ${monitorId} closed`);
        }
    }

    /**
     * Wait for the next message on a persistent client. Messages received
     * while no check was waiting are buffered and consumed first. The timeout
     * is reset every time a message is received, so the check only fails when
     * no message arrives within `interval` seconds of silence. If the client
     * is disconnected from the broker, an error is thrown.
     * @param {object} monitor Monitor object
     * @returns {Promise<[string, string][]|null>} Received message pairs, or null on timeout
     */
    waitForMessage(monitor) {
        const entry = this.persistentClients.get(monitor.id);

        if (!entry) {
            return Promise.reject(new Error("Persistent MQTT client not found"));
        }

        return new Promise((resolve, reject) => {
            // Consume a message buffered while no check was waiting
            if (entry.messageQueue.length > 0) {
                resolve(entry.messageQueue);
                // Clear the message queue to avoid memory growth if messages are received faster than checks
                entry.messageQueue = [];
                return;
            }

            const timeoutDuration = monitor.interval * 1000 * 0.8;

            const waiter = {
                resolve: (message) => {
                    cleanup();
                    resolve(message);
                },
                reject: (error) => {
                    cleanup();
                    reject(error);
                },
            };

            const cleanup = () => {
                clearTimeout(timeoutID);
                const index = entry.waiters.indexOf(waiter);
                if (index !== -1) {
                    entry.waiters.splice(index, 1);
                }
            };

            const onTimeout = () => {
                cleanup();
                resolve(null);
            };

            const timeoutID = setTimeout(onTimeout, timeoutDuration);
            entry.waiters.push(waiter);
        });
    }
}

module.exports = {
    MqttMonitorType,
};
