const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const mqtt = require("mqtt");
const jsonata = require("jsonata");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators, defaultNumberOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");

/**
 * Check if a received MQTT topic matches a subscription filter.
 * Supports + (single-level) and # (multi-level) wildcards per the MQTT spec.
 * @param {string} filter Subscription filter (may contain wildcards)
 * @param {string} topic Received topic (concrete, no wildcards)
 * @returns {boolean} True if the topic matches the filter
 */
function topicMatches(filter, topic) {
    const filterParts = filter.split("/");
    const topicParts = topic.split("/");
    for (let i = 0; i < filterParts.length; i++) {
        if (filterParts[i] === "#") {
            return true;
        }
        if (i >= topicParts.length) {
            return false;
        }
        if (filterParts[i] !== "+" && filterParts[i] !== topicParts[i]) {
            return false;
        }
    }
    return filterParts.length === topicParts.length;
}

class MqttMonitorType extends MonitorType {
    name = "mqtt";

    supportsConditions = true;

    conditionVariables = [
        new ConditionVariable("topic", defaultStringOperators),
        new ConditionVariable("message", defaultStringOperators),
        new ConditionVariable("json_value", defaultStringOperators.concat(defaultNumberOperators)),
    ];

    /**
     * Persistent MQTT clients keyed by broker connection string.
     * Multiple monitors targeting the same broker share one connection.
     * @type {Map<string, { client: import("mqtt").MqttClient, subscribedTopics: Set<string> }>}
     */
    clients = new Map();

    /**
     * Last-known connection key and topic for each monitor, used to detect
     * broker/topic changes and to clean up on monitor stop.
     * @type {Map<number, { connectionKey: string, topic: string }>}
     */
    monitorStates = new Map();

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const [messageTopic, receivedMessage] = await this.mqttAsync(monitor.id, monitor.hostname, monitor.mqttTopic, {
            port: monitor.port,
            username: monitor.mqttUsername,
            password: monitor.mqttPassword,
            interval: monitor.interval,
            websocketPath: monitor.mqttWebsocketPath,
        });

        if (monitor.mqttCheckType == null || monitor.mqttCheckType === "") {
            monitor.mqttCheckType = "keyword";
        }

        // Check if conditions are defined
        const conditions = monitor.conditions ? ConditionExpressionGroup.fromMonitor(monitor) : null;
        const hasConditions = conditions && conditions.children && conditions.children.length > 0;

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
     * Unsubscribe a topic from a connection entry and close the client if it
     * has no remaining subscribers.
     * @param {string} connectionKey Key into this.clients
     * @param {string} topic Topic to unsubscribe
     * @returns {void}
     */
    releaseTopicSubscription(connectionKey, topic) {
        const entry = this.clients.get(connectionKey);
        if (!entry) {
            return;
        }
        entry.subscribedTopics.delete(topic);
        entry.client.unsubscribe(topic);
        log.debug(this.name, `MQTT unsubscribed from topic ${topic}`);

        if (entry.subscribedTopics.size === 0) {
            log.debug(this.name, "MQTT no remaining subscribers, closing connection");
            this.clients.delete(connectionKey);
            entry.client.end();
        }
    }

    /**
     * @inheritdoc
     */
    stop(monitor) {
        const state = this.monitorStates.get(monitor.id);
        if (state) {
            this.releaseTopicSubscription(state.connectionKey, state.topic);
            this.monitorStates.delete(monitor.id);
        }
    }

    /**
     * Wait for a live (non-retained) message on the given topic, reusing an
     * existing broker connection when one already exists for the same broker.
     * The connection is only torn down on broker errors; timeouts leave it open.
     * @param {number} monitorId Monitor ID used to track per-monitor state
     * @param {string} hostname Hostname / address of the broker
     * @param {string} topic MQTT topic to subscribe to
     * @param {object} options MQTT options: port, username, password, websocketPath, interval
     * @returns {Promise<[string, string]>} Tuple of [messageTopic, message]
     */
    mqttAsync(monitorId, hostname, topic, options = {}) {
        return new Promise((resolve, reject) => {
            const { port, username, password, websocketPath, interval = 20 } = options;

            // Normalize hostname
            if (!/^(?:http|mqtt|ws)s?:\/\//.test(hostname)) {
                hostname = "mqtt://" + hostname;
            }

            // Build broker URL
            let mqttUrl = `${hostname}:${port}`;
            if (hostname.startsWith("ws://") || hostname.startsWith("wss://")) {
                if (websocketPath && !websocketPath.startsWith("/")) {
                    mqttUrl = `${hostname}:${port}/${websocketPath || ""}`;
                } else {
                    mqttUrl = `${hostname}:${port}${websocketPath || ""}`;
                }
            }

            const connectionKey = `${mqttUrl}\x00${username ?? ""}`;

            // If this monitor previously used a different broker or topic, release the old subscription
            const prevState = this.monitorStates.get(monitorId);
            if (prevState && (prevState.connectionKey !== connectionKey || prevState.topic !== topic)) {
                this.releaseTopicSubscription(prevState.connectionKey, prevState.topic);
                this.monitorStates.delete(monitorId);
            }

            // Get or create a persistent client for this broker
            let entry = this.clients.get(connectionKey);
            if (!entry) {
                log.debug(this.name, `MQTT connecting to ${mqttUrl}`);

                const client = mqtt.connect(mqttUrl, {
                    username,
                    password,
                    clientId: "uptime-kuma_" + Math.random().toString(16).substring(2, 10),
                });

                entry = { client, subscribedTopics: new Set() };
                this.clients.set(connectionKey, entry);

                // Persistent error handler: clean up only on connection-level failures
                client.on("error", () => {
                    log.debug(this.name, "MQTT connection error, dropping client");
                    this.clients.delete(connectionKey);
                    client.end();
                });
            } else {
                log.debug(this.name, "MQTT reusing existing connection");
            }

            const { client } = entry;

            // Record the current broker + topic for this monitor so changes are detected next check
            this.monitorStates.set(monitorId, { connectionKey, topic });

            // --- Per-check handlers ---

            let settled = false;

            const settle = (fn) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeoutID);
                client.removeListener("message", onMessage);
                client.removeListener("error", onError);
                fn();
            };

            const onMessage = (messageTopic, message, packet) => {
                if (packet.retain) {
                    log.debug(this.name, "MQTT retained message ignored");
                    return;
                }
                if (!topicMatches(topic, messageTopic)) {
                    return;
                }
                settle(() => resolve([messageTopic, message.toString("utf8")]));
            };

            const onError = (error) => {
                settle(() => reject(error));
            };

            const timeoutID = setTimeout(
                () => {
                    log.debug(this.name, "MQTT timeout triggered");
                    // Keep the connection alive — just stop waiting for this check cycle
                    settle(() => reject(new Error("Timeout, Message not received")));
                },
                interval * 1000 * 0.8
            );

            // Subscribe to this topic if not already subscribed on this connection.
            // Attach the message listener only after the subscribe callback fires so that
            // retained messages (delivered by the broker before SUBACK) are never seen.
            if (!entry.subscribedTopics.has(topic)) {
                entry.subscribedTopics.add(topic);
                client.subscribe(topic, (err) => {
                    if (err) {
                        log.debug(this.name, `MQTT subscribe error for topic ${topic}: ${err.message}`);
                    } else {
                        log.debug(this.name, `MQTT subscribed to topic ${topic}`);
                    }
                    client.on("message", onMessage);
                });
            } else {
                client.on("message", onMessage);
            }

            client.once("error", onError);
        });
    }
}

module.exports = {
    MqttMonitorType,
};
