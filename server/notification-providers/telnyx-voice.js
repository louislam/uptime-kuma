const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const crypto = require("crypto");
const { log } = require("../../src/util");

/**
 * How much clock skew/delivery delay to tolerate when checking the
 * telnyx-timestamp header, to limit replay of old signed events.
 * @type {number}
 */
const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Telnyx Voice notification provider.
 * Uses the Telnyx Call Control API to place an outbound call and read the
 * alert message via text-to-speech when the call is answered.
 *
 * The static {@link TelnyxVoice.pendingCalls} map stores in-flight call state
 * so that the webhook handler in api-router can deliver the speak / hangup
 * commands once the call is answered.
 */
class TelnyxVoice extends NotificationProvider {
    name = "telnyxVoice";

    /**
     * Holds call state for in-progress voice calls, keyed by call_control_id.
     * Each entry is { speechText: string, apiKey: string, publicKey: string }.
     * Entries are removed after the call ends or after a 5-minute safety timeout.
     * @type {Map<string, {speechText: string, apiKey: string, publicKey: string}>}
     */
    static pendingCalls = new Map();

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // Build the spoken text using either the Liquid template or the plain alert message
            let speechText;
            if (
                notification.telnyxVoiceUseTemplate &&
                notification.telnyxVoiceText &&
                notification.telnyxVoiceText.trim()
            ) {
                speechText = await this.renderTemplate(notification.telnyxVoiceText, msg, monitorJSON, heartbeatJSON);
            } else {
                speechText = msg;
            }

            const baseUrl = (notification.telnyxVoiceBaseUrl || "").replace(/\/+$/, "");
            const webhookUrl = baseUrl + "/api/telnyx-voice-callback";

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.telnyxApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const callResponse = await axios.post(
                "https://api.telnyx.com/v2/calls",
                {
                    connection_id: notification.telnyxVoiceAppId,
                    to: notification.telnyxToNumber,
                    from: notification.telnyxPhoneNumber,
                    webhook_url: webhookUrl,
                    webhook_url_method: "POST",
                },
                config
            );

            const callControlId = callResponse.data.data.call_control_id;

            TelnyxVoice.pendingCalls.set(callControlId, {
                speechText,
                apiKey: notification.telnyxApiKey,
                publicKey: notification.telnyxWebhookPublicKey,
            });

            // Safety clean-up: remove stale entry after 5 minutes in case
            // the call never reaches a terminal state.
            setTimeout(() => {
                TelnyxVoice.pendingCalls.delete(callControlId);
            }, 300000);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Verify that a webhook request was genuinely signed by Telnyx.
     * Telnyx signs webhooks with Ed25519; see
     * https://developers.telnyx.com/docs/change-management/webhooks/signing
     * @param {Buffer} rawBody Raw (unparsed) request body bytes
     * @param {object} headers Request headers (lowercased, as provided by Express)
     * @param {string} publicKeyBase64 Base64-encoded Ed25519 public key from the Telnyx portal
     * @returns {boolean} True if the signature is valid and fresh
     */
    static verifyWebhookSignature(rawBody, headers, publicKeyBase64) {
        try {
            if (!publicKeyBase64 || !Buffer.isBuffer(rawBody) || !headers) {
                return false;
            }

            const signatureBase64 = headers["telnyx-signature-ed25519"];
            const timestamp = headers["telnyx-timestamp"];

            if (!signatureBase64 || !timestamp) {
                return false;
            }

            // Reject stale or future-dated events to limit replay of captured payloads.
            const timestampAgeSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
            if (!Number.isFinite(timestampAgeSeconds) || timestampAgeSeconds > WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
                return false;
            }

            const rawPublicKey = Buffer.from(publicKeyBase64, "base64");
            if (rawPublicKey.length !== 32) {
                return false;
            }

            // Telnyx provides a raw 32-byte Ed25519 key; import it as a JWK
            // (RFC 8037 "OKP") so no external dependency or DER wrapping is needed.
            const publicKey = crypto.createPublicKey({
                key: {
                    kty: "OKP",
                    crv: "Ed25519",
                    x: rawPublicKey.toString("base64url"),
                },
                format: "jwk",
            });

            const signature = Buffer.from(signatureBase64, "base64");
            if (signature.length !== 64) {
                return false;
            }

            const signedPayload = Buffer.concat([ Buffer.from(`${timestamp}|`), rawBody ]);

            return crypto.verify(null, signedPayload, publicKey, signature);
        } catch (e) {
            return false;
        }
    }

    /**
     * Handle an incoming Telnyx Call Control webhook event.
     * Called by the /api/telnyx-voice-callback route in api-router.js.
     * @param {object} event The parsed JSON body from Telnyx
     * @param {Buffer} rawBody Raw (unparsed) request body bytes, needed to verify the signature
     * @param {object} headers Request headers from the webhook request
     * @returns {Promise<void>}
     */
    static async handleWebhook(event, rawBody, headers) {
        if (!event || !event.data || !event.data.payload) {
            return;
        }

        const eventType = event.data.event_type;
        const callControlId = event.data.payload.call_control_id;

        const pending = TelnyxVoice.pendingCalls.get(callControlId);
        if (!pending) {
            // Not an Uptime Kuma managed call; ignore.
            return;
        }

        if (!TelnyxVoice.verifyWebhookSignature(rawBody, headers, pending.publicKey)) {
            log.warn("telnyx-voice", "Rejected webhook for call " + callControlId + ": signature verification failed");
            return;
        }

        const requestHeaders = {
            "Content-Type": "application/json",
            Authorization: "Bearer " + pending.apiKey,
        };

        if (eventType === "call.answered") {
            // Speak the alert message via text-to-speech.
            await axios.post(
                `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/speak`,
                {
                    payload: pending.speechText,
                    payload_type: "text",
                    voice: "female",
                    language: "en-US",
                },
                { headers: requestHeaders }
            );
        } else if (eventType === "call.speak.ended") {
            // Hang up once the message has finished.
            await axios.post(
                `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/hangup`,
                {},
                { headers: requestHeaders }
            );
            TelnyxVoice.pendingCalls.delete(callControlId);
        }
    }
}

module.exports = TelnyxVoice;
