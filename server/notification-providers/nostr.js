const NotificationProvider = require("./notification-provider");
const {
    finalizeEvent,
    Relay,
    kinds,
    nip04,
    nip19,
    nip42,
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
                kind: kinds.EncryptedDirectMessage,
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
            const relay = await Relay.connect(relayUrl);
            let eventIndex = 0;

            // Authenticate to the relay, if required
            try {
                await relay.publish(events[0]);
                eventIndex = 1;
            } catch (error) {
                if (relay.challenge) {
                    await relay.auth(async (evt) => {
                        return finalizeEvent(evt, senderPrivateKey);
                    });
                }
            }

            try {
                for (let i = eventIndex; i < events.length; i++) {
                    await relay.publish(events[i]);
                }
                relay.close();
                successfulRelays++;
            } catch (error) {
                console.error(`Failed to publish event to ${relayUrl}:`, error);
            }
        }

        // Report success or failure
        if (successfulRelays === 0) {
            throw Error("Failed to connect to any relays.");
        }
        return `${successfulRelays}/${relays.length} relays connected.`;
    }

    /**
     * Sign the authentication event
     * @param {Relay} relay Relay instance
     * @param {string} privateKey Sender's private key
     * @returns {Promise<VerifiedEvent>} Signed authentication event
     */
    async signAuthEvent(relay, privateKey) {
        const authEvent = nip42.makeAuthEvent(relay.url, relay.challenge);
        return finalizeEvent(authEvent, privateKey);
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
