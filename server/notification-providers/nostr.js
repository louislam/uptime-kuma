const NotificationProvider = require("./notification-provider");
const {
    finalizeEvent,
    Relay,
    nip04,
    nip19,
} = require("nostr-tools");

// polyfills for node versions
const semver = require("semver");
const nodeVersion = process.version;
if (semver.lt(nodeVersion, "20.0.0")) {
    // polyfills for node 18
    global.crypto = require("crypto");
    global.WebSocket = require("isomorphic-ws");
} else {
    // polyfills for node 20
    global.WebSocket = require("isomorphic-ws");
}

class Nostr extends NotificationProvider {
    name = "nostr";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        // All DMs should have same timestamp
        const createdAt = Math.floor(Date.now() / 1000);

        const senderPrivateKey = await this.getPrivateKey(notification.sender);
        const recipientsPublicKeys = await this.getPublicKeys(notification.recipients);

        // Create NIP-04 encrypted direct message event for each recipient
        const events = [];
        for (const recipientPublicKey of recipientsPublicKeys) {
            const ciphertext = await nip04.encrypt(senderPrivateKey, recipientPublicKey, msg);
            let event = {
                kind: 4,
                created_at: createdAt,
                tags: [[ "p", recipientPublicKey ]],
                content: ciphertext,
            };
            const signedEvent = finalizeEvent(event, senderPrivateKey);
            events.push(signedEvent);
        }

        // Publish events to each relay
        const relays = notification.relays.split("\n");
        let successfulRelays = 0;
        for (const relayUrl of relays) {
            try {
                const relay = await Relay.connect(relayUrl);

                // Publish events
                for (const event of events) {
                    await relay.publish(event);
                }
                relay.close();
                successfulRelays++;
            } catch (error) {
                continue;
            }
        }

        // Report success or failure
        if (successfulRelays === 0) {
            throw Error("Failed to connect to any relays.");
        }
        return `${successfulRelays}/${relays.length} relays connected.`;
    }

    /**
     * Get the private key for the sender
     * @param {string} sender Sender to retrieve key for
     * @returns {nip19.DecodeResult} Private key
     */
    async getPrivateKey(sender) {
        try {
            const senderDecodeResult = await nip19.decode(sender);
            const { data } = senderDecodeResult;
            return data;
        } catch (error) {
            throw new Error(`Failed to get private key: ${error.message}`);
        }
    }

    /**
     * Get public keys for recipients
     * @param {string} recipients Newline delimited list of recipients
     * @returns {Promise<nip19.DecodeResult[]>} Public keys
     */
    async getPublicKeys(recipients) {
        const recipientsList = recipients.split("\n");
        const publicKeys = [];
        for (const recipient of recipientsList) {
            try {
                const recipientDecodeResult = await nip19.decode(recipient);
                const { type, data } = recipientDecodeResult;
                if (type === "npub") {
                    publicKeys.push(data);
                } else {
                    throw new Error("not an npub");
                }
            } catch (error) {
                throw new Error(`Error decoding recipient: ${error}`);
            }
        }
        return publicKeys;
    }
}

module.exports = Nostr;
